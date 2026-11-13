@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo A instalar (so na primeira vez)...
  call npm install
)
start "" http://localhost:3000/gestao/
node servidor.js
pause
