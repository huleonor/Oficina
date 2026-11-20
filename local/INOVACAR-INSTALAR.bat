@echo off
rem ==================================================================
rem  INOVACAR Tempos - instalador num so ficheiro (Windows)
rem
rem  Copie este ficheiro para o computador da oficina e de dois cliques.
rem  Faz tudo sozinho:
rem    - pede administrador;
rem    - descarrega o codigo do GitHub para C:\INOVACAR\Oficina;
rem    - usa o Node.js que ja estiver instalado (so instala se faltar);
rem    - liga a pagina ao Excel C:\INOVACAR\dados\tempos.xlsx;
rem    - poe o servidor a arrancar com o Windows;
rem    - abre o browser com a pagina sempre que alguem entra no Windows;
rem    - cria atalhos no Ambiente de Trabalho.
rem  Precisa de internet so durante a instalacao.
rem ==================================================================
setlocal EnableExtensions
title INOVACAR Tempos - Instalador
set "DEST=C:\INOVACAR\Oficina"
set "ZIPURL=https://github.com/huleonor/Oficina/archive/refs/heads/main.zip"
set "LOG=%TEMP%\INOVACAR-INSTALAR.log"

rem Pedir administrador (abre uma janela nova, elevada, com este mesmo ficheiro).
net session >nul 2>&1
if errorlevel 1 (
  echo A pedir permissoes de administrador...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo ==================================================
echo             INOVACAR TEMPOS - INSTALADOR
echo ==================================================
echo.

rem Parar o servidor antigo (se existir) para poder atualizar os ficheiros.
schtasks /End /TN "INOVACAR Tempos" >nul 2>&1

echo [1/2] A descarregar o codigo para %DEST% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "try {" ^
  "  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "  $zip=Join-Path $env:TEMP 'inovacar.zip'; $tmp=Join-Path $env:TEMP 'inovacar-codigo';" ^
  "  $ProgressPreference='SilentlyContinue';" ^
  "  Invoke-WebRequest '%ZIPURL%' -OutFile $zip -UseBasicParsing;" ^
  "  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force };" ^
  "  Expand-Archive $zip $tmp -Force;" ^
  "  $src=(Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName;" ^
  "  if (-not $src) { throw 'O ZIP nao tem a pasta esperada.' };" ^
  "  New-Item -ItemType Directory -Force '%DEST%' | Out-Null;" ^
  "  robocopy $src '%DEST%' /E /XD node_modules /NFL /NDL /NJH /NJS /NP | Out-Null;" ^
  "  if ($LASTEXITCODE -ge 8) { throw ('A copia falhou (robocopy ' + $LASTEXITCODE + ').') };" ^
  "  Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "  Write-Host '      Codigo atualizado.' -ForegroundColor Green" ^
  "} catch { Write-Host ('[ERRO] ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }" > "%LOG%" 2>&1
if errorlevel 1 (
  type "%LOG%"
  echo.
  echo Nao foi possivel descarregar o codigo. Confirme a internet e tente outra vez.
  echo.
  pause
  exit /b 1
)
type "%LOG%"

if not exist "%DEST%\local\instalar-windows.ps1" (
  echo [ERRO] Falta %DEST%\local\instalar-windows.ps1
  pause
  exit /b 1
)

echo.
echo [2/2] A instalar...
powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\local\instalar-windows.ps1"
set "CODIGO=%errorlevel%"

echo.
if "%CODIGO%"=="0" (
  echo Pronto. A pagina abre sozinha sempre que entrar no Windows.
) else (
  echo A instalacao terminou com erro %CODIGO%. Veja C:\INOVACAR\dados\instalacao.log
)
echo.
pause
exit /b %CODIGO%
