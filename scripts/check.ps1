# scripts/check.ps1
# Health check: reports the status of all three layers of the stack.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/check.ps1

$ErrorActionPreference = 'Continue'
Import-Module (Join-Path $PSScriptRoot 'lib\Clinica.psm1') -Force

$root = Get-ProjectRoot
$docker = Get-DockerPath

Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '  CLINICA MEDICA - STACK HEALTH CHECK' -ForegroundColor Cyan
Write-Host '==================================================' -ForegroundColor Cyan

# 1. Docker
& $docker ps 2>$null | Out-Null
$dockerUp = ($LASTEXITCODE -eq 0)
Write-Host ''
if ($dockerUp) {
    Write-Host '  [DOCKER]    RUNNING' -ForegroundColor Green
} else {
    Write-Host '  [DOCKER]    DOWN (run: sc start com.docker.service)' -ForegroundColor Red
}

# 2. Supabase backend
$container = Get-SupabaseDbContainer
if ($dockerUp -and $container) {
    Write-Host '  [SUPABASE]  DB container present: ' $container -ForegroundColor Green
    # Postgres reachable?
    & $docker exec $container pg_isready -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host '  [POSTGRES]  ACCEPTING CONNECTIONS' -ForegroundColor Green }
    else { Write-Host '  [POSTGRES]  NOT READY' -ForegroundColor Red }

    # Auth/API reachable?
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:54321/auth/v1/health' -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        Write-Host '  [AUTH]      http://127.0.0.1:54321 OK' -ForegroundColor Green
    } catch {
        Write-Host '  [AUTH]      not responding' -ForegroundColor Red
    }
    # Rest/API reachable?
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:54321/rest/v1/' -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        Write-Host '  [REST]      http://127.0.0.1:54321/rest/v1/ OK' -ForegroundColor Green
    } catch {
        Write-Host '  [REST]      not responding' -ForegroundColor Red
    }
} else {
    Write-Host '  [SUPABASE]  NOT STARTED' -ForegroundColor Red
}

# 3. Frontend server(s)
$webOk = $false
foreach ($port in 3000, 5173, 4173) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "  [FRONTEND]  dev server ON port $port" -ForegroundColor Green
        $webOk = $true
    } catch { }
}
if (-not $webOk) {
    # check if a vite process is running but different port
    $viteProc = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*vite*' -or ($_.Path -like '*node*') }
    if (Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 3000,5173,4173 }) {
        Write-Host '  [FRONTEND]  dev server listening (custom port)' -ForegroundColor Green
    } else {
        Write-Host '  [FRONTEND]  NOT RUNNING' -ForegroundColor Red
    }
}

Write-Host ''
Write-Host 'Quick start:' -ForegroundColor Cyan
Write-Host '  .\scripts\start-all.ps1          # full stack, foreground' -ForegroundColor Gray
Write-Host '  .\scripts\start-backend.ps1      # supabase only' -ForegroundColor Gray
Write-Host '  .\scripts\start-frontend.ps1     # vite only' -ForegroundColor Gray
Write-Host '  .\scripts\reset-db.ps1           # destructive DB reset' -ForegroundColor Gray
Write-Host '  .\scripts\stop-all.ps1           # stop supabase' -ForegroundColor Gray