@echo off
title PÁTRAČ — adresa pro mobil
cd /d "%~dp0"

set PORT=8080

call start-local.bat

echo.
echo --- MOBIL (stejna WiFi) ---
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do echo Otevri na telefonu: http://%%b:%PORT%/
)
echo.
pause
