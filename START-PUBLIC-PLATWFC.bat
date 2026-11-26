@echo off
setlocal EnableExtensions
title PLATWFC Public Server

set "ROOT=%~dp0"
set "SERVER_DIR=%ROOT%server"
set "ENV_FILE=%ROOT%.env"
set "CADDY_FILE=%ROOT%Caddyfile.windows"

echo.
echo  ========================================
echo       PLATWFC - PUBLIC SERVER
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Install Node.js 20 or newer first.
    start "" "https://nodejs.org/"
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found. Repair your Node.js installation.
    pause
    exit /b 1
)

if not exist "%ENV_FILE%" (
    copy "%ROOT%.env.example" "%ENV_FILE%" >nul
    echo Created .env from the example.
    echo Enter your domain and contact email in Notepad, save the file,
    echo then double-click START-PUBLIC-PLATWFC.bat again.
    start "" notepad.exe "%ENV_FILE%"
    pause
    exit /b 1
)

set "PLATWFC_DOMAIN="
set "ACME_EMAIL="
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if /I "%%A"=="PLATWFC_DOMAIN" set "PLATWFC_DOMAIN=%%B"
    if /I "%%A"=="ACME_EMAIL" set "ACME_EMAIL=%%B"
)

if not defined PLATWFC_DOMAIN (
    echo ERROR: PLATWFC_DOMAIN is missing from .env.
    start "" notepad.exe "%ENV_FILE%"
    pause
    exit /b 1
)
if not defined ACME_EMAIL (
    echo ERROR: ACME_EMAIL is missing from .env.
    start "" notepad.exe "%ENV_FILE%"
    pause
    exit /b 1
)

echo %PLATWFC_DOMAIN% | findstr /I "example.com" >nul
if not errorlevel 1 (
    echo ERROR: Replace the example domain in .env with your real domain.
    start "" notepad.exe "%ENV_FILE%"
    pause
    exit /b 1
)

echo %ACME_EMAIL% | findstr /I "example.com" >nul
if not errorlevel 1 (
    echo ERROR: Replace the example email in .env with your own contact email.
    start "" notepad.exe "%ENV_FILE%"
    pause
    exit /b 1
)

set "CADDY_EXE="
if exist "%ROOT%tools\caddy.exe" set "CADDY_EXE=%ROOT%tools\caddy.exe"
if not defined CADDY_EXE (
    for %%I in (caddy.exe) do set "CADDY_EXE=%%~$PATH:I"
)

if not defined CADDY_EXE (
    echo ERROR: Caddy was not found.
    echo Install the Windows caddy.exe from:
    echo https://caddyserver.com/docs/install
    echo Then add it to PATH or place it in the tools folder.
    start "" "https://caddyserver.com/docs/install"
    pause
    exit /b 1
)

if not exist "%SERVER_DIR%\node_modules" (
    echo Installing PLATWFC dependencies...
    pushd "%SERVER_DIR%"
    call npm install
    if errorlevel 1 (
        popd
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
    popd
)

echo Starting the PLATWFC Node.js server in a second window...
start "PLATWFC Node Server - keep open" /D "%SERVER_DIR%" cmd.exe /k "npm start"

echo Waiting for the Node.js server...
timeout /t 3 /nobreak >nul

echo Starting secure HTTPS and WebSocket proxy with Caddy.
echo Website: https://%PLATWFC_DOMAIN%
echo WebSocket: wss://%PLATWFC_DOMAIN%/ws
echo.
echo Keep both windows open while players are connected.
echo Press Ctrl+C in this Caddy window to stop Caddy.
echo Stop the Node.js server in its own window with Ctrl+C.
echo.

"%CADDY_EXE%" run --config "%CADDY_FILE%"
set "CADDY_EXIT=%ERRORLEVEL%"

echo.
echo Caddy stopped with exit code %CADDY_EXIT%.
pause
exit /b %CADDY_EXIT%
