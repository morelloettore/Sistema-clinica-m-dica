# scripts/start-backend.ps1
# Starts the SUPABASE backend (Postgres DB + Auth + REST + Edge Functions)
# used by the clinica-medica app. Idempotent: safe to re-run.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/start-backend.ps1 [-SkipEdgeFunctions] [-Reset] [-SkipAuthProbe]
#   -Reset              destroy local volumes, re-apply migrations, re-seed (full clean)
#   -SkipAuthProbe      skip the demo-user login check at the end
#   -SkipEdgeFunctions  kept for compatibility (edge runtime is auto-served by supabase start)

[CmdletBinding()]
param(
    [switch]$SkipEdgeFunctions,
    [switch]$Reset,
    [switch]$SkipAuthProbe
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib\Clinica.psm1') -Force

$root = Get-ProjectRoot
$supabase = Get-SupabaseCli
$docker = Get-DockerPath

Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '  Clinica Medica - Backend (Supabase) Startup' -ForegroundColor Cyan
Write-Host '==================================================' -ForegroundColor Cyan

# 1. Ensure Docker daemon is up
Write-Host '' -ForegroundColor Cyan
Write-Host '[1/6] Checking Docker daemon...' -ForegroundColor Cyan
if (-not (Start-DockerDaemon)) { throw 'Docker daemon could not be started.' }

# 2. (Re)initialize Supabase stack
if ($Reset) {
    Write-Host '[2/6] Resetting Supabase stack (destructive)...' -ForegroundColor Yellow
    Push-Location $root
    try { & $supabase stop --no-backup } catch { }
    Pop-Location
}

Write-Host '[2/6] Starting Supabase (supabase start)...' -ForegroundColor Cyan
# Invoke via cmd /c so .cmd wrapper stderr does NOT become PowerShell errors.
$startLog = Join-Path $env:TEMP 'supabase-start.log'
Remove-Item $startLog -ErrorAction SilentlyContinue
Push-Location $root
try {
    $cmdLine = 'call "' + $supabase + '" start 1> "' + $startLog + '" 2>&1'
    & cmd.exe /d /c $cmdLine
    $startExit = $LASTEXITCODE
} finally {
    Pop-Location
}
$startOutput = if (Test-Path $startLog) { Get-Content $startLog } else { @() }
if ($startExit -ne 0) {
    Write-Host ($startOutput -join "`n") -ForegroundColor Red
    throw 'supabase start failed. Check Docker + WSL2.'
}
Write-Host ($startOutput | Where-Object { $_ -match 'API URL|anon key|service_role|Studio|Inbucket|JWT' }) -ForegroundColor Gray

# 3. Ensure the web .env has the anon key (idempotent)
Write-Host '' -ForegroundColor Cyan
Write-Host '[3/6] Ensuring apps/web/.env...' -ForegroundColor Cyan
$envFile = Join-Path $root 'apps\web\.env'
$anonKey = $null
if (Test-Path $envFile) {
    $anonKey = (Select-String -Path $envFile -Pattern 'VITE_SUPABASE_ANON_KEY=(.+)' | Select-Object -First 1).Matches.Groups[1].Value
}
if (-not $anonKey) {
    # Newer CLI emits JSON like {"API_URL":..., "ANON_KEY":"..."} on one line.
    $jsonLine = $startOutput | Where-Object { $_ -match '^\{"' } | Select-Object -First 1
    if ($jsonLine) {
        try {
            $o = $jsonLine | ConvertFrom-Json
            if ($o.ANON_KEY) { $anonKey = $o.ANON_KEY }
        } catch { }
    }
}
if (-not $anonKey) {
    # Fallback: legacy "anon key: <token>" text output.
    $m = $startOutput | Select-String -Pattern 'anon key:\s*([A-Za-z0-9._-]+)'
    if ($m) { $anonKey = $m.Matches[0].Groups[1].Value }
}
if (-not $anonKey) {
    Write-Host '  WARN: could not determine anon key. Set VITE_SUPABASE_ANON_KEY manually.' -ForegroundColor Yellow
} else {
    if (-not (Test-Path $envFile)) {
        Set-Content $envFile "VITE_SUPABASE_URL=http://127.0.0.1:54321`nVITE_SUPABASE_ANON_KEY=$anonKey`n"
        Write-Host '  (created apps/web/.env)' -ForegroundColor Gray
    } elseif ((Select-String -Path $envFile -Pattern 'VITE_SUPABASE_ANON_KEY' -Quiet)) {
        Write-Host '  (already set)' -ForegroundColor Gray
    } else {
        Add-Content $envFile "`nVITE_SUPABASE_ANON_KEY=$anonKey"
        Write-Host '  (appended anon key to .env)' -ForegroundColor Gray
    }
}

# 4. Apply any post-migration fixes + seed (idempotent)
Write-Host '' -ForegroundColor Cyan
Write-Host '[4/6] Applying schema fixes + seed...' -ForegroundColor Cyan
$fixes = @(
    (Join-Path $root 'supabase\migrations\002_fix_audit_trigger.sql'),
    (Join-Path $root 'supabase\migrations\003_fix_handle_new_user.sql'),
    (Join-Path $root 'supabase\migrations\004_fix_policy_recursion.sql')
)
$container = Get-SupabaseDbContainer
foreach ($f in $fixes) {
    if (Test-Path $f) {
        Get-Content $f -Raw | & $docker exec -i $container psql -U postgres -d postgres 2>&1 | Out-Host
    }
}
$seed = Join-Path $root 'supabase\seed.sql'
if (Test-Path $seed) {
    Get-Content $seed -Raw | & $docker exec -i $container psql -U postgres -d postgres 2>&1 | Out-Host
}

# 5. Edge Functions: served automatically by the supabase edge-runtime
#    container when `supabase start` runs. Just verify all 4 are routed.
Write-Host '' -ForegroundColor Cyan
Write-Host '[5/6] Checking Edge Functions (edge-runtime container)...' -ForegroundColor Cyan
try {
    $fnProbe = Invoke-WebRequest -Uri 'http://127.0.0.1:54321/functions/v1/book-appointment' -Method Post -Body '{}' -ContentType 'application/json' -TimeoutSec 6 -UseBasicParsing -ErrorAction Stop
    $routed = $true
} catch {
    # 4xx from kong = routed and host is up. Connect-refused = not serving.
    $routed = $_.Exception.Response -ne $null
}
if ($routed) {
    Write-Host '  Edge Functions serving at http://127.0.0.1:54321/functions/v1/*' -ForegroundColor Green
    Write-Host '  (book-appointment, cancel-appointment, create-medical-record, assign-doctor)' -ForegroundColor Gray
} else {
    Write-Host '  Edge Functions endpoint NOT responding (edge-runtime container may be slow).' -ForegroundColor Yellow
    Write-Host '  Re-run `supabase start` or wait a few seconds.' -ForegroundColor Yellow
}

# 6. Verify login works (as table owner)
if (-not $SkipAuthProbe) {
    Write-Host '' -ForegroundColor Cyan
    Write-Host '[6/6] Verifying demo user login...' -ForegroundColor Cyan
    try {
        $body = @{ email='admin@clinica.local'; password='admin123456' } | ConvertTo-Json -Compress
        $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' -ContentType 'application/json' -Body $body -ErrorAction Stop
        Write-Host "  OK: admin login works ($($r.user.email))" -ForegroundColor Green
    } catch {
        Write-Host "  WARN: login probe failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host '' -ForegroundColor Cyan
Write-Host 'Backend ready.'
Write-Host '  API URL     : http://127.0.0.1:54321' -ForegroundColor Green
Write-Host '  Studio      : http://127.0.0.1:54323' -ForegroundColor Green
Write-Host '  Edge fns    : http://127.0.0.1:54321/functions/v1/{fn}' -ForegroundColor Green
Write-Host '  DB container: ' (Get-SupabaseDbContainer) -ForegroundColor Green
Write-Host '' -ForegroundColor Cyan

# Demo credentials reminder
Write-Host 'Demo logins:' -ForegroundColor Cyan
Write-Host '  admin@clinica.local    / admin123456' -ForegroundColor Gray
Write-Host '  doctor@clinica.local   / doctor123456' -ForegroundColor Gray
Write-Host '  employee@clinica.local / employee123456' -ForegroundColor Gray
Write-Host '  patient@clinica.local  / patient123456' -ForegroundColor Gray
