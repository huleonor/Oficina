@echo off
rem Dois cliques: instala a INOVACAR Tempos a partir desta pasta, sem descarregar (pede administrador).
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-windows.ps1"
pause
