$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverDir = Join-Path $repoRoot "server"
$envFile = Join-Path $repoRoot ".env"
$caddyConfig = Join-Path $repoRoot "Caddyfile.windows"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 20+ is required. Install it and reopen PowerShell."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Reinstall Node.js with npm and reopen PowerShell."
}

if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $repoRoot ".env.example") $envFile
    Write-Host "Created .env from .env.example."
    Write-Host "Edit .env, set PLATWFC_DOMAIN and ACME_EMAIL, then run this script again."
    exit 1
}

# Load only the two expected public configuration values from the local .env file.
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*(PLATWFC_DOMAIN|ACME_EMAIL)\s*=\s*(.*?)\s*$') {
        $key = $Matches[1]
        $value = $Matches[2].Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

if ([string]::IsNullOrWhiteSpace($env:PLATWFC_DOMAIN) -or $env:PLATWFC_DOMAIN -match 'example\.com') {
    throw "Set a real domain in .env (PLATWFC_DOMAIN=your-domain) before starting public mode."
}
if ([string]::IsNullOrWhiteSpace($env:ACME_EMAIL) -or $env:ACME_EMAIL -match 'example\.com') {
    throw "Set a contact email in .env (ACME_EMAIL=you@your-domain) before starting public mode."
}

$caddyCommand = Get-Command caddy -ErrorAction SilentlyContinue
$caddyLocal = Join-Path $repoRoot "tools\caddy.exe"
if (Test-Path $caddyLocal) {
    $caddyExe = $caddyLocal
}
elseif ($caddyCommand) {
    $caddyExe = $caddyCommand.Source
}
else {
    throw "Caddy was not found. Install the Windows caddy.exe, add it to PATH or put it at tools\caddy.exe. See https://caddyserver.com/docs/install."
}

Push-Location $serverDir
$serverProcess = $null
try {
    if (-not (Test-Path (Join-Path $serverDir "node_modules"))) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
    }

    $logsDir = Join-Path $repoRoot "logs"
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    $stdout = Join-Path $logsDir "server-out.log"
    $stderr = Join-Path $logsDir "server-error.log"

    $nodeCommand = Get-Command node
    $serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @("server.js") -WorkingDirectory $serverDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr

    $healthy = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $status = Invoke-RestMethod -Uri "http://127.0.0.1:8080/health" -TimeoutSec 2
            if ($status.status -eq "ok") { $healthy = $true; break }
        }
        catch {
            if ($serverProcess.HasExited) { break }
        }
    }

    if (-not $healthy) {
        if ($serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -Force
        }
        throw "PLATWFC did not become healthy. Check logs\server-error.log."
    }

    Write-Host "PLATWFC Node server is running."
    Write-Host "Starting Caddy for https://$env:PLATWFC_DOMAIN and wss://$env:PLATWFC_DOMAIN/ws"
    Write-Host "Keep this PowerShell window open. Press Ctrl+C to stop both processes."
    & $caddyExe run --config $caddyConfig
    if ($LASTEXITCODE -ne 0) { throw "Caddy exited with code $LASTEXITCODE." }
}
finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
        Write-Host "PLATWFC Node server stopped."
    }
    Pop-Location
}
