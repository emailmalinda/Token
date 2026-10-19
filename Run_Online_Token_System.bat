@echo off
title Token System Online Server
echo ======================================================
echo       Starting Token System Server and Online Tunnel
echo ======================================================
echo.

:: 1. Check if node_modules exists
if not exist node_modules (
    echo [1/3] Installing dependencies...
    call npm install
    echo.
) else (
    echo [1/3] Dependencies verified.
)

:: 2. Start Node.js Server
echo [2/3] Starting Node.js Server on Port 3000...
start "" node server.js

:: Wait 3 seconds
timeout /t 3 /nobreak >nul

:: 3. Start Permanent Tunnel (subdomain: abans-token-lk)
echo [3/3] Starting Permanent Online Tunnel...
echo.
echo ======================================================
echo  Permanent URL: https://abans-token-lk.loca.lt
echo  Do NOT close this window while using the system!
echo ======================================================
echo.

call npx localtunnel --port 3000 --subdomain abans-token-lk

pause