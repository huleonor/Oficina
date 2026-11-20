# INOVACAR Tempos: abre a pagina no browser assim que o servidor responder.
# Usado pelo atalho do Ambiente de Trabalho e pelo arranque automatico (ao entrar no Windows).
# Ficheiro so com caracteres ASCII de proposito (o PowerShell 5 do Windows le mal acentos sem BOM).

param(
  [string]$Url = 'http://localhost/gestao/',
  [int]$Espera = 180
)

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

# Depois de ligar o computador o servidor pode demorar alguns segundos a arrancar.
$limite = (Get-Date).AddSeconds($Espera)
$ok = $false
while ((Get-Date) -lt $limite) {
  try {
    $r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}

if (-not $ok) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    "A pagina da INOVACAR ainda nao respondeu.`n`nEspere um pouco e use o atalho 'INOVACAR Tempos' no Ambiente de Trabalho.`nSe continuar, veja o registo em C:\INOVACAR\dados\servidor.log",
    'INOVACAR Tempos', 'OK', 'Warning') | Out-Null
  exit 1
}

Start-Process $Url
