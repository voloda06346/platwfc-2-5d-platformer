@echo off
setlocal EnableExtensions DisableDelayedExpansion
title PLATWFC - Repair updater

set "ROOT=%~dp0"
set "TEMP_UPDATER=%TEMP%\PLATWFC-update-fixed-%RANDOM%-%RANDOM%.bat"
set "UPDATER_URL=https://raw.githubusercontent.com/voloda06346/platwfc-2-5d-platformer/main/UPDATE-PLATWFC.bat"

echo.
echo  ========================================
echo       PLATWFC - REPAIR UPDATE TOOL
echo  ========================================
echo.
if not exist "%ROOT%START-PLATWFC.bat" (
  echo ERROR: This file must be placed in the PLATWFC project folder,
  echo next to START-PLATWFC.bat.
  goto :failed
)
where curl.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows curl.exe was not found.
  goto :failed
)

echo Downloading a clean copy of UPDATE-PLATWFC.bat...
curl.exe --fail --location --silent --show-error --retry 3 --connect-timeout 20 --max-time 120 -H "User-Agent: PLATWFC-Updater-Repair" "%UPDATER_URL%" --output "%TEMP_UPDATER%"
if errorlevel 1 (
  echo ERROR: Could not download the updater from GitHub.
  goto :failed
)
if not exist "%TEMP_UPDATER%" (
  echo ERROR: The replacement updater was not downloaded.
  goto :failed
)
findstr /C:"PLATWFC UPDATE COMPLETED SUCCESSFULLY" "%TEMP_UPDATER%" >nul
if errorlevel 1 (
  echo ERROR: The downloaded file did not pass its content check.
  goto :failed
)

copy /y "%TEMP_UPDATER%" "%ROOT%UPDATE-PLATWFC.bat" >nul
if errorlevel 1 (
  echo ERROR: Could not replace UPDATE-PLATWFC.bat.
  echo Close any open editor that may have locked that file, then retry.
  goto :failed
)
del "%TEMP_UPDATER%" >nul 2>nul

echo.
echo Updater repaired. Starting the project update now...
echo.
call "%ROOT%UPDATE-PLATWFC.bat"
exit /b %ERRORLEVEL%

:failed
if exist "%TEMP_UPDATER%" del "%TEMP_UPDATER%" >nul 2>nul
echo.
echo Repair did not complete. Read the error above.
echo.
pause
exit /b 1
