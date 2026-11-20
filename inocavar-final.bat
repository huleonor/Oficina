@echo off
setlocal EnableExtensions
title INOVACAR Tempos - Instalador
color 0B
set "DEST=C:\INOVACAR\Oficina"
set "LOG=%TEMP%\INOVACAR-INSTALAR.log"

echo.
echo ==================================================
echo             INOVACAR TEMPOS - INSTALADOR
echo ==================================================
echo Log: %LOG%
echo.

rem Pedir elevacao antes de iniciar, para nao perder a janela.
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo [INFO] A pedir permissoes de Administrador...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [1/3] A descarregar a branch MAIN do GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "try { Start-Transcript -Path $env:TEMP\INOVACAR-INSTALAR.log -Append -Force | Out-Null } catch {};" ^
  "try {" ^
  "  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "  $zip=Join-Path $env:TEMP 'inovacar.zip'; $tmp=Join-Path $env:TEMP 'inovacar-codigo';" ^
  "  Write-Host '[INFO] A transferir main.zip...';" ^
  "  Invoke-WebRequest 'https://github.com/huleonor/Oficina/archive/refs/heads/main.zip' -OutFile $zip -UseBasicParsing;" ^
  "  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force };" ^
  "  Write-Host '[INFO] A extrair os ficheiros...'; Expand-Archive $zip $tmp -Force;" ^
  "  $src=(Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName;" ^
  "  if (-not $src) { throw 'O ZIP nao contem a pasta esperada.' };" ^
  "  New-Item -ItemType Directory -Force '%DEST%' | Out-Null;" ^
  "  Write-Host '[INFO] A copiar ficheiros para %DEST% ...';" ^
  "  robocopy $src '%DEST%' /E /XD node_modules;" ^
  "  if ($LASTEXITCODE -ge 8) { throw ('Robocopy falhou com codigo ' + $LASTEXITCODE) };" ^
  "  Write-Host '[OK] Codigo atualizado a partir de MAIN.';" ^
  "} catch { Write-Host ('[ERRO] ' + $_.Exception.Message) -ForegroundColor Red; exit 1 } finally { try { Stop-Transcript | Out-Null } catch {} }"

if errorlevel 1 (
    echo.
    echo [ERRO] Falhou a descarga ou copia do codigo.
    echo Consulte o registo: %LOG%
    echo.
    pause
    exit /b 1
)

if not exist "%DEST%\local\instalar-windows.ps1" (
    echo.
    echo [ERRO] Nao foi encontrado: %DEST%\local\instalar-windows.ps1
    echo A branch MAIN pode nao conter o instalador esperado.
    pause
    exit /b 1
)

echo.
echo [2/3] A iniciar o instalador PowerShell...
echo [INFO] A janela permanece aberta para mostrar o progresso e os erros.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%DEST%\local\instalar-windows.ps1"
set "PSCODE=%errorlevel%"

echo.
echo [3/3] O instalador PowerShell terminou com codigo: %PSCODE%
echo Log da descarga: %LOG%
echo.
pause
exit /b %PSCODE%
