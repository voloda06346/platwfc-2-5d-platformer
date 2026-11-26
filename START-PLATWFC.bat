@echo off
setlocal EnableExtensions
title PLATWFC Server

set "ROOT=%~dp0"
set "SERVER_DIR=%ROOT%server"

echo.
echo  ========================================
echo       PLATWFC - LOCAL SERVER
echo  ========================================
echo.
echo Project folder: "%ROOT%"
echo Server folder:  "%SERVER_DIR%"
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Install Node.js 20 or newer, then restart Windows and try again.
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

if not exist "%SERVER_DIR%\package.json" (
    echo ERROR: The server folder or server\package.json was not found.
    echo.
    echo This usually means your local GitHub Desktop copy is outdated
    echo or this BAT file is not inside the project root folder.
    echo.
    echo Open GitHub Desktop, select this repository, click Fetch origin,
    echo then Pull origin. Make sure server\server.js and
    echo server\package.json exist next to this BAT file.
    echo.
    pause
    exit /b 1
)

pushd "%SERVER_DIR%"
if errorlevel 1 (
    echo ERROR: Cannot enter the server folder:
    echo "%SERVER_DIR%"
    pause
    exit /b 1
)

echo Current working folder:
cd
echo.

if not exist "node_modules\ws" (
    echo Installing PLATWFC server dependencies...
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
