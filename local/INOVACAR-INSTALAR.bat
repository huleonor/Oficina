@echo off
rem INOVACAR Tempos: um so ficheiro. Copie-o para o computador da oficina e de dois cliques.
rem Descarrega o codigo para C:\INOVACAR\Oficina e instala tudo (Node.js, Excel, arranque automatico).
rem Precisa de internet e pede administrador.
echo A descarregar a INOVACAR Tempos...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$zip=Join-Path $env:TEMP 'inovacar.zip'; $tmp=Join-Path $env:TEMP 'inovacar-codigo';" ^
  "Invoke-WebRequest 'https://github.com/huleonor/Oficina/archive/refs/heads/main.zip' -OutFile $zip -UseBasicParsing;" ^
  "if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }; Expand-Archive $zip $tmp;" ^
  "$src=(Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName; New-Item -ItemType Directory -Force 'C:\INOVACAR\Oficina' | Out-Null;" ^
  "robocopy $src 'C:\INOVACAR\Oficina' /E /XD node_modules /NFL /NDL /NJH /NJS | Out-Null; exit 0"
if errorlevel 1 (
  echo Nao foi possivel descarregar. Confirme a internet e tente outra vez.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\INOVACAR\Oficina\local\instalar-windows.ps1"
