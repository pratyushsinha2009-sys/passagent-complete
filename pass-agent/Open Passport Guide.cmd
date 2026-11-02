@echo off
title PassAgent - Passport Guide
cd /d "%~dp0"
echo Starting your passport guide.
echo Install the extension once from extensions\passport-guide before using this launcher.
echo Keep this window open while using AI guidance. Press Ctrl+C to stop.
start "" "https://www.passportindia.gov.in/"
call npm run dev:server
pause
