from pathlib import Path

content = r'''# INOVACAR Tempos: instala a página de gestão para correr sempre neste computador Windows.
#
# Corre com o botão direito > "Executar com o PowerShell" como administrador (ou pelo INSTALAR.bat).
# O que faz:
#   1. instala as dependências (npm, precisa de internet só agora);
#   2. guarda o Excel em C:\INOVACAR\dados\tempos.xlsx;
#   3. cria a tarefa "INOVACAR Tempos", que arranca com o Windows;
#   4. abre a porta na firewall para a rede da oficina;
#   5. opcionalmente muda o nome do computador para INOVACAR.
#
# O progresso aparece no terminal e fica registado em:
#   C:\INOVACAR\dados\instalacao.log
# O log do servidor continua em:
#   C:\INOVACAR\dados\servidor.log
#
# Para tirar: desinstalar-windows.ps1.

param(
  [string]$Nome = 'INOVACAR',
  [string]$Dados = 'C:\INOVACAR\dados',
  [int]$Porta = 80
)

$ErrorActionPreference = 'Stop'
$Tarefa = 'INOVACAR Tempos'
$Pasta = $PSScriptRoot

function Passo($t) {
  Write-Host "`n==================================================" -ForegroundColor DarkCyan
  Write-Host "> $t" -ForegroundColor Cyan
  Write-Host "==================================================" -ForegroundColor DarkCyan
}

function Info($t) { Write-Host "  [INFO] $t" -ForegroundColor Gray }
function Feito($t) { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  [AVISO] $t" -ForegroundColor Yellow }

# Se não for administrador, relança o mesmo script elevado.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Host 'A pedir permissões de administrador...' -ForegroundColor Yellow
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Nome `"$Nome`" -Dados `"$Dados`" -Porta $Porta"
  exit
}

# Criar a pasta de dados e iniciar o registo da execução.
New-Item -ItemType Directory -Force -Path $Dados | Out-Null
$Log = Join-Path $Dados 'instalacao.log'
try { Start-Transcript -Path $Log -Append -Force | Out-Null } catch {
  Write-Host "Não foi possível iniciar o log em $Log : $_" -ForegroundColor Yellow
}

# Registar erros inesperados e tentar fechar o transcript.
trap {
  Write-Host "`n[ERRO] A instalação foi interrompida: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Consulte o registo: $Log" -ForegroundColor Yellow
  try { Stop-Transcript | Out-Null } catch {}
  Read-Host 'Enter para fechar'
  exit 1
}

Write-Host "`nINOVACAR TEMPOS - INSTALADOR" -ForegroundColor Green
Write-Host "Terminal: progresso detalhado em tempo real"
Write-Host "Ficheiro de log: $Log" -ForegroundColor Gray

Passo '1/8 - Verificação do Node.js'
Info 'A procurar o executável node...'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host 'Falta o Node.js. Instale a versão LTS de https://nodejs.org e corra este ficheiro outra vez.' -ForegroundColor Red
  Read-Host 'Enter para sair'
  exit 1
}
$nodeVersao = & $node --version
Feito "Node.js encontrado: $node ($nodeVersao)"

Passo '2/8 - Instalação das dependências'
Info "Pasta de trabalho: $Pasta"
Info 'A executar npm install. O npm vai mostrar o detalhe do que está a descarregar e instalar.'
Info 'Esta operação pode demorar alguns minutos e requer Internet.'
Push-Location $Pasta
try {
  & npm install --omit=dev --no-audit --no-fund --verbose
  $npmExit = $LASTEXITCODE
  if ($npmExit -ne 0) { throw "O npm install falhou (código $npmExit)." }
  Feito 'Dependências instaladas.'
}
finally {
  Pop-Location
}

Passo '3/8 - Preparação da pasta de dados e do Excel'
Info "A garantir que existe a pasta: $Dados"
New-Item -ItemType Directory -Force -Path $Dados | Out-Null
$excel = Join-Path $Dados 'tempos.xlsx'
$antigo = Join-Path $Pasta 'tempos.xlsx'
if ((Test-Path $antigo) -and -not (Test-Path $excel)) {
  Info "A copiar o Excel inicial de $antigo para $excel"
  Copy-Item $antigo $excel
  Feito 'Excel existente copiado.'
} elseif (Test-Path $excel) {
  Info "O Excel já existe: $excel (não será substituído)."
} else {
  Aviso 'Não foi encontrado tempos.xlsx na pasta do instalador; confirme se o ficheiro será criado pela aplicação.'
}
Info 'A atribuir permissões de modificação aos utilizadores locais...'
& icacls $Dados /grant '*S-1-5-32-545:(OI)(CI)M' /T
if ($LASTEXITCODE -ne 0) { throw "Falha ao definir permissões na pasta $Dados." }
Feito 'Permissões da pasta de dados configuradas.'

Passo "4/8 - Verificação da porta TCP $Porta"
Info "A verificar se a porta $Porta já está a ser utilizada..."
$ocupada = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 }
$nossa = $ocupada | Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).Path -eq $node }
if ($ocupada -and -not $nossa) {
  Aviso "A porta $Porta está ocupada por outro programa. Será utilizada a porta 3000."
  $Porta = 3000
} else {
  Feito "A porta $Porta está disponível para a INOVACAR."
}

Passo '5/8 - Criação do serviço de arranque automático'
$cmd = Join-Path $Pasta 'servico.cmd'
Info "A criar o ficheiro de arranque: $cmd"
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
Feito 'Ficheiro servico.cmd criado.'

Info "A remover a tarefa agendada anterior, se existir: $Tarefa"
Unregister-ScheduledTask -TaskName $Tarefa -Confirm:$false -ErrorAction SilentlyContinue
Info 'A procurar processos antigos servidor.js para evitar duas instâncias...'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*servidor.js*' } |
  ForEach-Object {
    Info "A terminar processo antigo PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
  }

Info 'A configurar a tarefa para arrancar no início do Windows como SYSTEM...'
$acao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$cmd`"" -WorkingDirectory $Pasta
$quando = New-ScheduledTaskTrigger -AtStartup
$quem = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$regras = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $quando -Principal $quem -Settings $regras -Description 'Página de gestão da INOVACAR (tempos) com o Excel em C:\INOVACAR\dados.' | Out-Null
Feito 'Tarefa agendada registada.'
Info 'A iniciar a tarefa agora...'
Start-ScheduledTask -TaskName $Tarefa
Feito 'Pedido de arranque enviado. O servidor escreve em servidor.log.'

Passo '6/8 - Configuração da firewall'
Info 'A remover uma regra antiga da INOVACAR, se existir...'
Get-NetFirewallRule -DisplayName $Tarefa -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Info "A abrir TCP $Porta nos perfis Privado e Domínio..."
New-NetFirewallRule -DisplayName $Tarefa -Direction Inbound -Protocol TCP -LocalPort $Porta -Action Allow -Profile Private, Domain | Out-Null
Feito "Regra de firewall criada para a porta $Porta."
Info 'A verificar se a rede está classificada como Pública...'
$redes = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }
if ($redes) {
  Aviso "A rede '$($redes[0].Name)' está como Pública: os telemóveis não conseguem aceder."
  Aviso 'A alterar as redes encontradas para Privada...'
  $redes | Set-NetConnectionProfile -NetworkCategory Private
  Feito 'Perfil de rede alterado para Privado.'
} else {
  Feito 'Não foi encontrada nenhuma rede Pública a alterar.'
}

Passo "7/8 - Nome na rede: $Nome"
$sufixo = if ($Porta -eq 80) { '' } else { ":$Porta" }
$mudar = $false
if ($env:COMPUTERNAME -ne $Nome.ToUpper()) {
  $r = Read-Host "  O computador chama-se $env:COMPUTERNAME. Mudar para $Nome (pede reiniciar)? [S/n]"
  if ($r -notmatch '^[nN]') {
    Info "A solicitar alteração do nome do computador para $Nome..."
    Rename-Computer -NewName $Nome -Force
    $mudar = $true
    Feito 'Alteração do nome solicitada; será aplicada após reiniciar.'
  } else {
    Info 'O nome atual do computador será mantido.'
  }
} else {
  Feito "O computador já tem o nome $Nome."
}

Passo '8/8 - Teste final da aplicação'
Info 'A aguardar 3 segundos para o servidor iniciar...'
Start-Sleep -Seconds 3
Info "A testar http://localhost$sufixo/gestao/ (tempo limite: 10 segundos)..."
$ok = try {
  (Invoke-WebRequest "http://localhost$sufixo/gestao/" -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200
} catch {
  Aviso "O teste HTTP ainda não respondeu: $($_.Exception.Message)"
  $false
}
Info 'A obter o endereço IPv4 deste computador...'
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
$n = $Nome.ToLower()

Write-Host "`n================ INOVACAR Tempos ================" -ForegroundColor Green
if ($ok) {
  Feito 'A aplicação respondeu corretamente (HTTP 200).'
} else {
  Aviso 'Ainda não respondeu: consulte C:\INOVACAR\dados\servidor.log para ver o arranque do servidor.'
}
Write-Host "  Neste computador:        http://localhost$sufixo/gestao/"
Write-Host "  Computadores Windows:    http://$n$sufixo/gestao/"
Write-Host "  Telemóveis e Mac:        http://$n.local$sufixo/gestao/"
Write-Host "  Se o nome não abrir:     http://$ip$sufixo/gestao/"
Write-Host "  Excel:                   $excel"
Write-Host "  Log da instalação:       $Log"
Write-Host "  Log do servidor:         $Dados\servidor.log"
if ($mudar) { Write-Host "`nO nome $Nome só fica ativo depois de reiniciar o computador." -ForegroundColor Yellow }

Feito 'Instalação concluída.'
try { Stop-Transcript | Out-Null } catch {}
Read-Host "`nEnter para fechar"
'''
path = Path("/mnt/data/instalar-windows-com-logs.ps1")
path.write_text(content, encoding="utf-8-sig")
print(path)
