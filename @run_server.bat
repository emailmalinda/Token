@echo off
title Node.js Server Runner
echo Checking for node_modules...

:: node_modules නැතිනම් පමණක් npm install run වේ
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo Starting the server...
node server.js
pause