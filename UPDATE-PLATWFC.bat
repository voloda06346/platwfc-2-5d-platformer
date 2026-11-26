@echo off
setlocal EnableExtensions
title PLATWFC - Update from GitHub

set "ROOT=%~dp0"
set "WORK=%TEMP%\PLATWFC-update-%RANDOM%-%RANDOM%"
set "ZIP=%WORK%\source.zip"
set "EXTRACT=%WORK%\source"

echo.
echo  ========================================
echo       PLATWFC - SAFE PROJECT UPDATE
echo  ========================================
echo.
echo Project: "%ROOT%"
echo.
where curl.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows curl.exe was not found.
  echo This updater requires Windows 10 or Windows 11.
  pause
  exit /b 1
)
where tar.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows tar.exe was not found.
  pause
  exit /b 1
)

mkdir "%WORK%" >nul 2>nul
echo Downloading the latest PLATWFC files from GitHub...
curl.exe -fL --retry 2 "https://codeload.github.com/voloda06346/platwfc-2-5d-platformer/zip/refs/heads/main" -o "%ZIP%"
if errorlevel 1 (
  echo ERROR: Download failed. Check your internet connection.
  rmdir /s /q "%WORK%" >nul 2>nul
  pause
  exit /b 1
)

echo Extracting update...
mkdir "%EXTRACT%" >nul 2>nul
tar.exe -xf "%ZIP%" -C "%EXTRACT%"
if errorlevel 1 (
  echo ERROR: Could not extract the update.
  rmdir /s /q "%WORK%" >nul 2>nul
  pause
  exit /b 1
)

for /d %%D in ("%EXTRACT%\platwfc-2-5d-platformer-*") do set "SOURCE=%%D"
if not defined SOURCE (
  echo ERROR: The downloaded repository folder was not found.
  rmdir /s /q "%WORK%" >nul 2>nul
  pause
  exit /b 1
)

echo Updating project files...
robocopy "%SOURCE%" "%ROOT%" /E /R:2 /W:1 /XF ".env" /XD ".git" "node_modules" >nul
set "COPY_EXIT=%ERRORLEVEL%"
if %COPY_EXIT% GEQ 8 (
  echo ERROR: File copy failed with code %COPY_EXIT%.
  rmdir /s /q "%WORK%" >nul 2>nul
  pause
  exit /b %COPY_EXIT%
)

rmdir /s /q "%WORK%" >nul 2>nul
echo.
echo PLATWFC files updated successfully.
echo Your .env and node_modules folders were left untouched.
echo Now run START-PLATWFC.bat.
echo.
pause
exit /b 0
