@echo off
setlocal EnableExtensions DisableDelayedExpansion
title PLATWFC - Update from GitHub

set "ROOT=%~dp0"
set "WORK=%TEMP%\PLATWFC-update-%RANDOM%-%RANDOM%"
set "ZIP=%WORK%\source.zip"
set "EXTRACT=%WORK%\source"
set "SOURCE="

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
  echo Use Windows 10 or Windows 11 and install pending Windows updates.
  goto :failed
)
where tar.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows tar.exe was not found.
  echo The built-in Windows archive tool is required.
  goto :failed
)

mkdir "%WORK%" >nul 2>nul
if not exist "%WORK%" (
  echo ERROR: Could not create the temporary update folder:
  echo "%WORK%"
  goto :failed
)

echo [1/4] Downloading the latest files from GitHub...
curl.exe --fail --location --silent --show-error --retry 4 --retry-delay 2 --connect-timeout 20 --max-time 300 -H "User-Agent: PLATWFC-Updater" "https://codeload.github.com/voloda06346/platwfc-2-5d-platformer/zip/refs/heads/main" --output "%ZIP%"
if errorlevel 1 (
  echo First download address failed. Trying GitHub archive mirror...
  curl.exe --fail --location --silent --show-error --retry 2 --connect-timeout 20 --max-time 300 -H "User-Agent: PLATWFC-Updater" "https://github.com/voloda06346/platwfc-2-5d-platformer/archive/refs/heads/main.zip" --output "%ZIP%"
  if errorlevel 1 (
    echo ERROR: GitHub download failed.
    echo Check the internet connection or try again later.
    goto :failed
  )
)

if not exist "%ZIP%" (
  echo ERROR: GitHub did not create the ZIP file.
  goto :failed
)
for %%Z in ("%ZIP%") do if %%~zZ LSS 1024 (
  echo ERROR: The downloaded ZIP is empty or incomplete.
  goto :failed
)

echo [2/4] Extracting the update...
mkdir "%EXTRACT%" >nul 2>nul
tar.exe -xf "%ZIP%" -C "%EXTRACT%"
if errorlevel 1 (
  echo ERROR: Windows could not extract the GitHub ZIP.
  echo The download may be incomplete. Run this updater again.
  goto :failed
)

for /d %%D in ("%EXTRACT%\*") do if not defined SOURCE set "SOURCE=%%~fD"
if not defined SOURCE (
  echo ERROR: The extracted GitHub project folder was not found.
  goto :failed
)
if not exist "%SOURCE%\index.html" (
  echo ERROR: The downloaded folder does not contain index.html.
  echo Refusing to copy an incomplete project.
  goto :failed
)

echo [3/4] Copying updated game and server files...
echo The updater keeps .env, node_modules, .git and this running BAT file.
robocopy "%SOURCE%" "%ROOT%" /E /R:3 /W:2 /COPY:DAT /DCOPY:DAT /FFT /NP /XF ".env" "UPDATE-PLATWFC.bat" /XD ".git" "node_modules" /TEE
set "COPY_EXIT=%ERRORLEVEL%"
if %COPY_EXIT% GEQ 8 (
  echo.
  echo ERROR: Some project files could not be copied.
  echo Robocopy exit code: %COPY_EXIT%
  goto :failed
)

echo [4/4] Cleaning temporary files...
rmdir /s /q "%WORK%" >nul 2>nul
echo.
echo ========================================
echo   PLATWFC UPDATE COMPLETED SUCCESSFULLY
echo ========================================
echo.
echo Your .env, node_modules, .git and this updater were kept.
echo Now run START-PLATWFC.bat and refresh the game with Ctrl+F5.
echo.
pause
exit /b 0

:failed
if defined WORK rmdir /s /q "%WORK%" >nul 2>nul
echo.
echo UPDATE FAILED. No project files were intentionally removed.
echo Check the error message above. Keep this window open to read it.
echo.
pause
exit /b 1
