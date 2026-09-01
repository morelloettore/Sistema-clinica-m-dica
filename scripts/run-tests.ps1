# scripts/run-tests.ps1
# Runs the FULL test suite for the clinica-medica stack:
#   [1/5] pnpm lint                 (all packages)
#   [2/5] pnpm typecheck            (all packages)
#   [3/5] pnpm --filter @clinica/web test   (174 vitest tests)
#   [4/5] SQL suites (business_rules.sql + rls_policies.sql) against local PG
#   [5/5] Edge Function smoke probe (routed via edge-runtime)
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1
#   -SkipWeb      skip lint/typecheck/vitest (SQL tests only)
#   -SkipSql      skip the SQL suites (web only) — no DB needed
#   -SkipEdge     skip the edge-function probe
#   -ExitCode     sets exit code to 1 if any suite failed (CI friendly)

[CmdletBinding()]
param(
    [switch]$SkipWeb,
    [switch]$SkipSql,
    [switch]$SkipEdge,
    [switch]$ExitCode
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib\Clinica.psm1') -Force

$root = Get-ProjectRoot
$pnpm = Get-PnpmPath
$docker = Get-DockerPath
$failures = @()

# turbo resolves the package-manager binary from PATH; make sure the npm
# global bin directory (where pnpm.cmd lives) is present even in shells
# whose PATH doesn't include it.
$npmBin = Split-Path $pnpm
if ($env:PATH -notlike "*$npmBin*") {
    $env:PATH = "$npmBin;$env:PATH"
}

function Write-Step($msg) {
    Write-Host ''
    Write-Host $msg -ForegroundColor Cyan
}

function Invoke-And-Check {
    param([string]$Label, [scriptblock]$Action)
    Write-Host "  -> $Label" -ForegroundColor Gray
    try {
        & $Action
        if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
        Write-Host "  OK" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Invoke-SqlFile {
    param([string]$Path, [ValidateSet('postgres', 'exec')]$Mode = 'exec')
    $data = Get-Content $Path -Raw
    if ($Mode -eq 'exec') {
        & $docker exec -i (Get-SupabaseDbContainer) psql -U postgres -d postgres -v ON_ERROR_STOP=0 2>&1 |
            Where-Object { $_ -match 'NOTICE|ERROR|FATAL' }
        if ($LASTEXITCODE -ne 0) { throw "psql failed" }
    }
}

Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '  Clinica Medica - FULL TEST SUITE' -ForegroundColor Cyan
Write-Host '==================================================' -ForegroundColor Cyan

# ---------------------------------------------------------------------------
if (-not $SkipWeb) {
    Write-Step '[1/5] LINT'
    Push-Location $root
    try {
        Invoke-And-Check 'turbo lint' { & $pnpm lint }
    } finally { Pop-Location }

    Write-Step '[2/5] TYPECHECK'
    Push-Location $root
    try {
        Invoke-And-Check 'turbo typecheck' { & $pnpm typecheck }
    } finally { Pop-Location }

    Write-Step '[3/5] WEB TESTS (vitest)'
    Push-Location $root
    try {
        Invoke-And-Check 'pnpm --filter @clinica/web test' { & $pnpm --filter @clinica/web test }
    } finally { Pop-Location }
} else {
    Write-Host 'Skipping web test suites (-SkipWeb).' -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
if (-not $SkipSql) {
    Write-Step '[4/5] SQL SUITES (Postgres)'
    $container = Get-SupabaseDbContainer
    if (-not $container) {
        Write-Host '  Supabase DB not running. Start it first: scripts\start-backend.ps1' -ForegroundColor Red
        $failures += 'SQL suites (no DB)'
    } else {
        $sqlFiles = @(
            (Join-Path $root 'supabase\tests\business_rules.sql'),
            (Join-Path $root 'supabase\tests\rls_policies.sql')
        )
        $totalFail = 0
        $totalDone = 0
        foreach ($f in $sqlFiles) {
            Write-Host "  Suite: $([System.IO.Path]::GetFileName($f))" -ForegroundColor Gray
            # Run through cmd /c so psql stderr (NOTICEs) is captured into a log
            # file, never merged into the PowerShell pipeline as error records.
            $log = Join-Path $env:TEMP ("sqlsuite-" + [System.IO.Path]::GetFileNameWithoutExtension($f) + ".log")
            Remove-Item $log -ErrorAction SilentlyContinue
            $cmdLine = 'call "' + $docker + '" exec -i "' + $container + '" psql -U postgres -d postgres -v ON_ERROR_STOP=0 < "' + $f + '" 1> "' + $log + '" 2>&1'
            & cmd.exe /d /c $cmdLine
            $out = if (Test-Path $log) { Get-Content $log } else { @() }
            $passes = @($out | Where-Object { $_ -match 'PASS:' }).Count
            $fails = @($out | Where-Object { $_ -match '(\bFAIL:|^ERROR:|FATAL)' } | Where-Object { $_ -notmatch 'transaction is aborted' }).Count
            $totalDone += $passes
            $totalFail += $fails
            Write-Host "    PASS: $passes   FAIL: $fails" -ForegroundColor $(if ($fails -eq 0) { 'Green' } else { 'Red' })
            if ($fails -gt 0) {
                Write-Host ($out | Where-Object { $_ -match 'FAIL:|^ERROR:|FATAL' }) -ForegroundColor Red
                $script:failures += "SQL: $([System.IO.Path]::GetFileName($f))"
            }
        }
    }
} else {
    Write-Host 'Skipping SQL suites (-SkipSql).' -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
if (-not $SkipEdge) {
    Write-Step '[5/5] EDGE FUNCTIONS PROBE'
    try {
        $probe = Invoke-WebRequest -Uri 'http://127.0.0.1:54321/functions/v1/book-appointment' `
            -Method Post -Body '{}' -ContentType 'application/json' -TimeoutSec 6 -UseBasicParsing -ErrorAction Stop
        # A JWT-less / empty-body call reaching the function body returns a 4xx
        # from the handler (her.route did execute) OR 401 from Kong (routed).
        $code = [int]$probe.StatusCode
        if ($code -ge 200 -and $code -lt 500) {
            Write-Host "  Edge function responded (HTTP $code)." -ForegroundColor Green
        }
        Write-Host '  Edge Functions reachable.' -ForegroundColor Green
    } catch {
        $resp = $_.Exception.Response
        if ($resp -and [int]$resp.StatusCode -lt 500) {
            Write-Host "  Edge Functions reachable (HTTP $([int]$resp.StatusCode))." -ForegroundColor Green
        } else {
            Write-Host "  Edge Functions NOT reachable: $($_.Exception.Message)" -ForegroundColor Red
            $script:failures += 'Edge Functions probe'
        }
    }
} else {
    Write-Host 'Skipping edge-function probe (-SkipEdge).' -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '==================================================' -ForegroundColor Cyan
if ($failures.Count -eq 0) {
    Write-Host 'RESULT: ALL SUITES PASSED' -ForegroundColor Green
    if ($ExitCode) { exit 0 }
} else {
    Write-Host "RESULT: $($failures.Count) SUITE(S) FAILED:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    if ($ExitCode) { exit 1 }
}
Write-Host '==================================================' -ForegroundColor Cyan