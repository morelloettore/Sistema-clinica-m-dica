# scripts/start-frontend.ps1
# Installs dependencies and starts the Vue 3 Vite dev server.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/start-frontend.ps1 [-Install] [-Port <n>]
#   -Install   run pnpm install first (default: auto-install if node_modules missing)
#   -Port      Vite dev server port (default 3000)
#   -Preview   run the production preview (vite preview) instead of dev server

[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Preview,
    [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib\Clinica.psm1') -Force

$root = Get-ProjectRoot
$pnpm = Get-PnpmPath
$webDir = Join-Path $root 'apps\web'
$rootModules = Join-Path $root 'node_modules'

Write-Host '==================================================' -ForegroundColor Green
Write-Host '  Clinica Medica - Frontend (Vue/Vite) Startup' -ForegroundColor Green
Write-Host '==================================================' -ForegroundColor Green

# 1. Install dependencies if needed
if ($Install -or -not (Test-Path $rootModules)) {
    Write-Host '' -ForegroundColor Green
    Write-Host '[1/2] Installing dependencies (pnpm install)...' -ForegroundColor Green
    Push-Location $root
    try {
        & $pnpm install
        if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed.' }
    } finally {
        Pop-Location
    }
} else {
    Write-Host '' -ForegroundColor Green
    Write-Host '[1/2] Dependencies present.'
}

# 2. Start the dev server (long-running; keep in foreground)
Write-Host '' -ForegroundColor Green
Write-Host '[2/2] Starting Vite dev server...' -ForegroundColor Green
Push-Location $webDir
try {
    if ($Preview) {
        Write-Host "  (production preview) http://127.0.0.1:$Port" -ForegroundColor Gray
        & $pnpm preview -- --host 127.0.0.1 --port $Port
    } else {
        Write-Host "  (dev server) http://127.0.0.1:$Port" -ForegroundColor Gray
        & $pnpm dev -- --host 127.0.0.1 --port $Port
    }
    if ($LASTEXITCODE -ne 0) { throw 'Vite exited with an error.' }
} finally {
    Pop-Location
}
