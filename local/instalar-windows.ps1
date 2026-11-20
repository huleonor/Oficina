# INOVACAR Tempos: instala a página de gestão para correr sempre neste computador Windows.
#
# Corre com o botão direito > "Executar com o PowerShell" como administrador (ou pelo INSTALAR.bat).
# O que faz:
#   1. instala as dependências (npm, precisa de internet só agora);
#   2. guarda o Excel em C:\INOVACAR\dados\tempos.xlsx (a pasta que a oficina abre no Excel);
#   3. cria a tarefa "INOVACAR Tempos", que arranca com o Windows (mesmo sem ninguém iniciar sessão)
#      e volta a arrancar o servidor se ele parar;
#   4. abre a porta na firewall para a rede da oficina (Wi-Fi/rede privada);
#   5. se quiser, muda o nome do computador para INOVACAR, para o endereço ser http://inovacar/.
#
# Para tirar: desinstalar-windows.ps1.

param(
  [string]$Nome = 'INOVACAR',           # nome do computador na rede (o "domínio" local)
  [string]$Dados = 'C:\INOVACAR\dados', # onde fica o Excel
  [int]$Porta = 80                      # 80: o endereço não precisa de :porta
)

$ErrorActionPreference = 'Stop'
$Tarefa = 'INOVACAR Tempos'
$Pasta = $PSScriptRoot

function Passo($t) { Write-Host "`n> $t" -ForegroundColor Cyan }

# Administrador
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Nome $Nome -Dados `"$Dados`" -Porta $Porta"
  exit
}

Passo 'Node.js'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host 'Falta o Node.js. Instale a versão LTS de https://nodejs.org e corra este ficheiro outra vez.' -ForegroundColor Red; Read-Host 'Enter para sair'; exit 1 }
Write-Host "  $node ($(& $node --version))"

Passo 'Dependências (só da primeira vez precisa de internet)'
Push-Location $Pasta
& npm install --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'O npm install falhou.' }
Pop-Location

Passo "Pasta dos dados: $Dados"
New-Item -ItemType Directory -Force -Path $Dados | Out-Null
$excel = Join-Path $Dados 'tempos.xlsx'
$antigo = Join-Path $Pasta 'tempos.xlsx'
if ((Test-Path $antigo) -and -not (Test-Path $excel)) { Copy-Item $antigo $excel; Write-Host '  copiei o tempos.xlsx que já existia' }
# Quem usa o computador pode abrir e corrigir o Excel (o servidor corre como SYSTEM).
& icacls $Dados /grant '*S-1-5-32-545:(OI)(CI)M' /T | Out-Null

Passo "Porta $Porta"
$ocupada = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 }
$nossa = $ocupada | Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).Path -eq $node }
if ($ocupada -and -not $nossa) {
  Write-Host "  A porta $Porta está ocupada por outro programa: uso a 3000 (o endereço leva :3000)." -ForegroundColor Yellow
  $Porta = 3000
}

Passo 'Arranque automático'
# Um .cmd que arranca o servidor e o volta a arrancar se ele parar; o registo vai para dados\servidor.log.
$cmd = Join-Path $Pasta 'servico.cmd'
@"
@echo off
cd /d "$Pasta"
set PORTA=$Porta
set EXCEL=$excel
:arrancar
echo [%date% %time%] a arrancar >> "$Dados\servidor.log"
"$node" servidor.js >> "$Dados\servidor.log" 2>&1
timeout /t 5 /nobreak > nul
goto arrancar
"@ | Set-Content -Encoding ASCII $cmd

Unregister-ScheduledTask -TaskName $Tarefa -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*servidor.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$acao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$cmd`"" -WorkingDirectory $Pasta
$quando = New-ScheduledTaskTrigger -AtStartup
$quem = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$regras = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $quando -Principal $quem -Settings $regras -Description 'Página de gestão da INOVACAR (tempos) com o Excel em C:\INOVACAR\dados.' | Out-Null
Start-ScheduledTask -TaskName $Tarefa
Write-Host '  a tarefa arranca com o Windows e já está a correr'

Passo 'Firewall'
Get-NetFirewallRule -DisplayName $Tarefa -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $Tarefa -Direction Inbound -Protocol TCP -LocalPort $Porta -Action Allow -Profile Private, Domain | Out-Null
$redes = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }
if ($redes) {
  Write-Host "  A rede '$($redes[0].Name)' está como Pública: os telemóveis não chegam cá. Mudo para Privada." -ForegroundColor Yellow
  $redes | Set-NetConnectionProfile -NetworkCategory Private
}

Passo "Nome na rede: $Nome"
$sufixo = if ($Porta -eq 80) { '' } else { ":$Porta" }
$mudar = $false
if ($env:COMPUTERNAME -ne $Nome.ToUpper()) {
  $r = Read-Host "  O computador chama-se $env:COMPUTERNAME. Mudar para $Nome (pede reiniciar)? [S/n]"
  if ($r -notmatch '^[nN]') { Rename-Computer -NewName $Nome -Force; $mudar = $true }
}

Start-Sleep -Seconds 3
$ok = try { (Invoke-WebRequest "http://localhost$sufixo/gestao/" -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 } catch { $false }
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
$n = $Nome.ToLower()
Write-Host "`n================ INOVACAR Tempos ================" -ForegroundColor Green
Write-Host ($(if ($ok) { 'A correr.' } else { 'Ainda não respondeu: veja C:\INOVACAR\dados\servidor.log' }))
Write-Host "  Neste computador:        http://localhost$sufixo/gestao/"
Write-Host "  Computadores Windows:    http://$n$sufixo/gestao/"
Write-Host "  Telemóveis e Mac:        http://$n.local$sufixo/gestao/"
Write-Host "  Se o nome não abrir:     http://$ip$sufixo/gestao/"
Write-Host "  Excel:                   $excel"
if ($mudar) { Write-Host "`nO nome $Nome só fica ativo depois de reiniciar o computador." -ForegroundColor Yellow }
Read-Host "`nEnter para fechar"
