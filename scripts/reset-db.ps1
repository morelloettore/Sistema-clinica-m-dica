# scripts/reset-db.ps1
# Destructive full reset of the LOCAL supabase stack:
#   supabase stop --no-backup  ->  supabase start  ->  (re)apply migrations + seed
# All data is wiped and re-created from migrations 001-004 + seed.sql.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/reset-db.ps1 [-SkipFixes] [-SkipProbe]

[CmdletBinding()]
param(
    [switch]$SkipFixes,
    [switch]$SkipProbe
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib\Clinica.psm1') -Force

$root = Get-ProjectRoot
$supabase = Get-SupabaseCli
$docker = Get-DockerPath
$container = Get-SupabaseDbContainer

Write-Host '==================================================' -ForegroundColor Magenta
Write-Host '  CLINICA MEDICA - FULL DATABASE RESET' -ForegroundColor Magenta
Write-Host '  DESTRUCTIVE: wipes all local supabase data' -ForegroundColor Red
Write-Host '==================================================' -ForegroundColor Magenta

$confirm = Read-Host "Type 'RESET' to continue"
if ($confirm -ne 'RESET') {
    Write-Host 'Aborted.' -ForegroundColor Yellow
    exit 1
}

# 1. Ensure docker
Write-Host '[1/4] Ensuring Docker daemon...' -ForegroundColor Cyan
if (-not (Start-DockerDaemon)) { throw 'Docker not available.' }

# 2. Stop + wipe
Write-Host '[2/4] Stopping Supabase and removing volumes...' -ForegroundColor Cyan
Push-Location $root
try { & cmd.exe /d /c "call `"$supabase`" stop --no-backup 1>nul 2>&1" } catch { }
Pop-Location

# 3. Restart (re-applies migrations)
Write-Host '[3/4] Restarting Supabase (re-applies migrations 001-004)...' -ForegroundColor Cyan
$startLog = Join-Path $env:TEMP 'supabase-reset-start.log'
Remove-Item $startLog -ErrorAction SilentlyContinue
Push-Location $root
try {
    & cmd.exe /d /c "call `"$supabase`" start 1> `"$startLog`" 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "supabase start failed (exit $LASTEXITCODE). See $startLog" }
    if (Test-Path $startLog) { Get-Content $startLog | Where-Object { $_ -match 'API_URL|ANON_KEY|STUDIO_URL' } }
} finally {
    Pop-Location
}

# 4. Post-migration fixes + seed
Write-Host '[4/4] Applying fixes + seed...' -ForegroundColor Cyan
$container = Get-SupabaseDbContainer
if ($container) {
    if (-not $SkipFixes) {
        foreach ($f in @(
            (Join-Path $root 'supabase\migrations\002_fix_audit_trigger.sql'),
            (Join-Path $root 'supabase\migrations\003_fix_handle_new_user.sql')
        )) {
            if (Test-Path $f) {
                Get-Content $f -Raw | & $docker exec -i $container psql -U postgres -d postgres 2>&1 | Out-Host
            }
        }
    }
    $seed = Join-Path $root 'supabase\seed.sql'
    if (Test-Path $seed) {
        Get-Content $seed -Raw | & $docker exec -i $container psql -U postgres -d postgres 2>&1 | Out-Host
    }
}

# Verify
if (-not $SkipProbe) {
    try {
        $body = @{ email='admin@clinica.local'; password='admin123456' } | ConvertTo-Json -Compress
        $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' -ContentType 'application/json' -Body $body -ErrorAction Stop
        Write-Host "  Login probe OK ($($r.user.email))" -ForegroundColor Green
    } catch {
        Write-Host "  WARN: login probe failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Database reset complete.' -ForegroundColor Green