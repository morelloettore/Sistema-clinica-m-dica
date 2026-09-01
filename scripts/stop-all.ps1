# scripts/stop-all.ps1
# Stops the Supabase backend and any detached Edge Function server.
# (The Vite dev server is stopped with Ctrl+C in its own terminal.)
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/stop-all.ps1 [-KeepVolumes]

[CmdletBinding()]
param(
    [switch]$KeepVolumes
)

$ErrorActionPreference = 'Continue'
Import-Module (Join-Path $PSScriptRoot 'lib\Clinica.psm1') -Force

$root = Get-ProjectRoot
$supabase = Get-SupabaseCli
$docker = Get-DockerPath

Write-Host 'Stopping Supabase stack...' -ForegroundColor Yellow

# Stop detached node/edge serve processes we may have started
$serveLog = Join-Path $env:TEMP 'supabase-functions.log'
if (Test-Path $serveLog) {
    Get-Process | Where-Object { $_.ProcessName -match 'supabase|node|deno' -and $_.Path -match 'supabase' } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

Push-Location $root
try {
    if ($KeepVolumes) {
        & cmd.exe /d /c "call `"$supabase`" stop 1>nul 2>&1"
    } else {
        & cmd.exe /d /c "call `"$supabase`" stop --no-backup 1>nul 2>&1"
    }
} finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Done. Supabase stopped.' -ForegroundColor Green
Write-Host '  Frontend dev server: close with Ctrl+C in its own terminal.' -ForegroundColor Gray
