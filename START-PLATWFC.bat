@echo off
setlocal
title PLATWFC Server

cd /d "%~dp0"

echo.
echo  ========================================
echo       PLATWFC - LOCAL SERVER
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Install Node.js 20 or newer, then double-click this file again.
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

pushd "%~dp0server"

if not exist "node_modules" (
    echo First run: installing PLATWFC dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed.
        popd
        pause
        exit /b 1
    )
)

echo.
echo PLATWFC will listen at:
echo   http://localhost:8080/health
echo   ws://localhost:8080/ws
echo.
echo Keep this window open while testing.
echo Press Ctrl+C to stop the server.
echo.

call npm start
set "SERVER_EXIT=%ERRORLEVEL%"

popd
echo.
echo PLATWFC stopped with exit code %SERVER_EXIT%.
pause
exit /b %SERVER_EXIT%
