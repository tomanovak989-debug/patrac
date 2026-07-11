@echo off
title PÁTRAČ — lokální náhled
cd /d "%~dp0"

set PORT=8080
set URL=http://localhost:%PORT%/

netstat -ano 2>nul | findstr ":%PORT%" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo Server uz bezi — oteviram prohlizec...
    start "" "%URL%"
    exit /b 0
)

echo Spoustim PÁTRAČ: %URL%
echo Uloz si zkratku na plose: PATRAC lokalne
echo.

start "" "%URL%"

where py >nul 2>&1
if %errorlevel%==0 (
    start "PATRAC-server" /min py -m http.server %PORT%
    exit /b 0
)

where python >nul 2>&1
if %errorlevel%==0 (
    start "PATRAC-server" /min python -m http.server %PORT%
    exit /b 0
)

echo Python neni v PATH — spoustim vestaveny PowerShell server...
start "PATRAC-server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %PORT%
exit /b 0
