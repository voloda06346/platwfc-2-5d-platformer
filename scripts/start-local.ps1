$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverDir = Join-Path $repoRoot "server"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed or not on PATH. Install Node.js 20+ and reopen PowerShell."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Reinstall Node.js 20+ with npm and reopen PowerShell."
}

Push-Location $serverDir
try {
    if (-not (Test-Path (Join-Path $serverDir "node_modules"))) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
    }

    Write-Host "Starting PLATWFC locally at http://localhost:8080/health"
    Write-Host "WebSocket endpoint: ws://localhost:8080/ws"
    Write-Host "Press Ctrl+C to stop."
    npm start
    if ($LASTEXITCODE -ne 0) { throw "PLATWFC exited with code $LASTEXITCODE." }
}
finally {
    Pop-Location
}
