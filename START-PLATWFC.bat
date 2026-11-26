@echo off
setlocal EnableExtensions
title PLATWFC - LOCAL SERVER

set "ROOT=%~dp0"
set "SERVER_DIR=%ROOT%server\"
set "SERVER_FILE=%SERVER_DIR%server.js"
set "PACKAGE_FILE=%SERVER_DIR%package.json"

echo.
echo  ========================================
echo       PLATWFC - LOCAL SERVER
echo  ========================================
echo.
echo Launcher: "%~f0"
echo Project:  "%ROOT%"
echo Server:   "%SERVER_DIR%"
echo.

if not exist "%SERVER_FILE%" (
  echo ERROR: server.js was not found.
  echo Expected file: "%SERVER_FILE%"
  echo.
  echo Make sure this folder contains a "server" folder
  echo with server.js and package.json inside it.
  echo You can inspect the project files here:
  echo https://github.com/voloda06346/platwfc-2-5d-platformer/tree/main/server
  echo.
  pause
  exit /b 1
)

if not exist "%PACKAGE_FILE%" (
  echo ERROR: package.json was not found.
  echo Expected file: "%PACKAGE_FILE%"
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  echo Install Node.js 20 or newer, then reopen this launcher.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found in PATH.
  pause
  exit /b 1
)

echo Installing/checking dependencies...
call npm --prefix "%SERVER_DIR%" install
if errorlevel 1 (
  echo.
  echo ERROR: Dependency installation failed.
  pause
  exit /b 1
)

if not exist "%SERVER_DIR%node_modules\ws" (
  echo ERROR: The ws package is missing after npm install.
  pause
  exit /b 1
)

echo.
echo Starting PLATWFC directly with Node.js...
echo Health:    http://localhost:8080/health
echo WebSocket: ws://localhost:8080/ws
echo Keep this window open. Press Ctrl+C to stop.
echo.

node "%SERVER_FILE%"
set "SERVER_EXIT=%ERRORLEVEL%"

echo.
echo PLATWFC stopped with exit code %SERVER_EXIT%.
pause
exit /b %SERVER_EXIT%
