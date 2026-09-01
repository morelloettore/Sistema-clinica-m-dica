# scripts/start-all.ps1
# One-shot orchestrator: starts Docker + Supabase backend (db/auth/edge), then
# the Vue frontend dev server. The frontend stays in the foreground; Ctrl+C to stop.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1 [-SkipEdgeFunctions] [-Reset]
#   -SkipEdgeFunctions  dont serve Edge Functions
#   -Reset              destructive full DB reset before starting

[CmdletBinding()]
param(
    [switch]$SkipEdgeFunctions,
    [switch]$Reset
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib\Clinica.psm1') -Force

$root = Get-ProjectRoot

Write-Host ''
Write-Host '##################################################' -ForegroundColor Cyan
Write-Host '#  CLINICA MEDICA - FULL STACK LAUNCH' -ForegroundColor Cyan
Write-Host '##################################################' -ForegroundColor Cyan

# 1. Backend
Write-Host '' 
Write-Host '>>> [1/2] Starting BACKEND (Supabase)...' -ForegroundColor Yellow
$backendArgs = @()
if ($SkipEdgeFunctions) { $backendArgs += '-SkipEdgeFunctions' }
if ($Reset) { $backendArgs += '-Reset' }
& (Join-Path $PSScriptRoot 'start-backend.ps1') @backendArgs
if ($LASTEXITCODE -ne 0) { throw 'Backend failed to start.' }

# 2. Frontend (blocking)
Write-Host ''
Write-Host '>>> [2/2] Starting FRONTEND (Vue/Vite)...' -ForegroundColor Yellow
& (Join-Path $PSScriptRoot 'start-frontend.ps1')
