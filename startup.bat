@echo off
:: Email Health Monitor - Auto-Startup Script
:: Runs silently at Windows startup via the Startup folder
:: Launches PM2 and restores the email-health-monitor process

:: Set full PATH so PM2 is found
set PATH=%PATH%;%APPDATA%\npm;C:\Program Files\nodejs;C:\Users\%USERNAME%\AppData\Roaming\npm

:: Wait for network
%windir%\system32\timeout.exe /t 3 /nobreak >nul

:: Start PM2 daemon if not running (resurrect restores saved processes)
CALL pm2 resurrect 2>nul

:: If resurrect failed (first time), start the app directly
IF %ERRORLEVEL% NEQ 0 (
    cd /d "C:\Users\Kaushal\Desktop\AI GTM\email-health-monitor"
    CALL pm2 start ecosystem.config.js
    CALL pm2 save
)

:: Log successful startup
echo %date% %time% - Email Health Monitor started >> "C:\Users\Kaushal\Desktop\AI GTM\email-health-monitor\logs\startup.log"
