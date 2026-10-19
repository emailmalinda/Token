@echo off
title Running Node Server and Kiosk
echo Starting Node.js Server...
start /b node server.js
timeout /t 3 /nobreak >nul
echo Opening Kiosk in Browser...
start http://localhost:3000/kiosk
start http://localhost:3000/display.html
start http://localhost:3000/counter.html

echo Server is running pro! Do not close this window.
pause