# scripts/lib/Clinica.psm1
# Shared helpers for the clinica-medica dev scripts.
# PowerShell 5.1 compatible.

$ErrorActionPreference = 'Stop'

# --- Path resolution (project root is two levels up from this module) ---
$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Get-ProjectRoot {
    return $script:Root
}

function Get-DockerPath {
    $candidates = @(
        'C:\Program Files\Docker\Docker\resources\bin\docker.exe',
        (Get-Command docker.exe -ErrorAction SilentlyContinue).Source
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    throw 'Docker binary not found. Install Docker Desktop or add it to PATH.'
}

function Get-SupabaseCli {
    $candidates = @(
        'C:\Users\mcmco\AppData\Roaming\npm\supabase.cmd',
        (Get-Command supabase.cmd -ErrorAction SilentlyContinue).Source,
        (Get-Command supabase -ErrorAction SilentlyContinue).Source
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    throw 'Supabase CLI not found. Run: npm install -g supabase'
}

function Get-PnpmPath {
    $candidates = @(
        'C:\Users\mcmco\AppData\Roaming\npm\pnpm.cmd',
        (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source,
        (Get-Command pnpm -ErrorAction SilentlyContinue).Source
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    throw 'pnpm not found. Run: npm install -g pnpm@9'
}

function Wait-DockerRunning {
    $docker = Get-DockerPath
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        & $docker ps 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $true }
        Start-Sleep -Seconds 3
    }
    Write-Warning 'Docker daemon not responding after 90s. Call Start-DockerDaemon first.'
    return $false
}

function Start-DockerDaemon {
    # Start the Docker Desktop Windows service if the engine is not up.
    $docker = Get-DockerPath
    & $docker ps 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host 'Docker already running.'; return $true }

    Write-Host 'Docker daemon not running. Starting com.docker.service...' -ForegroundColor Yellow
    try {
        sc.exe start com.docker.service 2>$null | Out-Null
    } catch { }
    Start-Sleep -Seconds 8

    # Docker Desktop may also need its host process; try launching the backend binary.
    if (-not (Wait-DockerRunning)) {
        try {
            & 'C:\Program Files\Docker\Docker\Docker Desktop.exe' 2>$null | Out-Null
        } catch { }
        Wait-DockerRunning | Out-Null
    }
    return $true
}

function Get-SupabaseDbContainer {
    $docker = Get-DockerPath
    $names = & $docker ps --format '{{.Names}}' 2>$null
    foreach ($n in $names) {
        if ($n -like 'supabase_db_*') { return $n }
    }
    return $null
}

function Invoke-Sql {
    # Pipe a SQL string into the supabase_db container.
    param(
        [Parameter(Mandatory = $true)][string]$Sql,
        [switch]$Quiet
    )
    $docker = Get-DockerPath
    $container = Get-SupabaseDbContainer
    if (-not $container) { throw 'Supabase DB container not found. Run Start-Backend first.' }

    $result = $Sql | & $docker exec -i $container psql -U postgres -d postgres 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "SQL execution failed: $($result -join ' ')"
    }
    if (-not $Quiet) { $result }
    return $result
}

function Test-DbUp {
    $docker = Get-DockerPath
    $container = Get-SupabaseDbContainer
    if (-not $container) { return $false }
    & $docker exec $container pg_isready -U postgres 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

Export-ModuleMember -Function `
    Get-ProjectRoot, Get-DockerPath, Get-SupabaseCli, Get-PnpmPath, `
    Wait-DockerRunning, Start-DockerDaemon, Get-SupabaseDbContainer, `
    Invoke-Sql, Test-DbUp
