# INOVACAR Tempos: instala a pagina de gestao para correr sempre neste computador Windows.
#
# Normalmente corre a partir do INOVACAR-INSTALAR.bat (ou do INSTALAR.bat). O que faz:
#   1. usa o Node.js que ja estiver instalado (so instala a versao LTS se faltar);
#   2. instala as dependencias (npm, precisa de internet so agora);
#   3. liga a pagina ao Excel em C:\INOVACAR\dados\tempos.xlsx;
#   4. cria a tarefa "INOVACAR Tempos", que arranca o servidor com o Windows;
#   5. abre a porta na firewall para a rede da oficina;
#   6. abre o browser com a pagina sempre que alguem entra no Windows;
#   7. cria atalhos no Ambiente de Trabalho (pagina e Excel);
#   8. testa a pagina e a ligacao ao Excel e abre o browser.
#
# Opcional: -MudarNome muda o nome do computador para INOVACAR (http://inovacar/gestao/ na rede).
# Registo da instalacao: C:\INOVACAR\dados\instalacao.log  |  Servidor: C:\INOVACAR\dados\servidor.log
# Para tirar: desinstalar-windows.ps1.
#
# Ficheiro so com caracteres ASCII de proposito (o PowerShell 5 do Windows le mal acentos sem BOM).

param(
  [string]$Nome = 'INOVACAR',
  [string]$Dados = 'C:\INOVACAR\dados',
  [int]$Porta = 80,
  [switch]$MudarNome
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Tarefa = 'INOVACAR Tempos'
$Pasta = $PSScriptRoot

function Passo($t) { Write-Host "`n> $t" -ForegroundColor Cyan }
function Info($t)  { Write-Host "  $t" -ForegroundColor Gray }
function Feito($t) { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  [AVISO] $t" -ForegroundColor Yellow }

# Se nao for administrador, relanca o mesmo script elevado.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Host 'A pedir permissoes de administrador...' -ForegroundColor Yellow
  $extra = if ($MudarNome) { ' -MudarNome' } else { '' }
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Nome `"$Nome`" -Dados `"$Dados`" -Porta $Porta$extra"
  exit
}

New-Item -ItemType Directory -Force -Path $Dados | Out-Null
$Log = Join-Path $Dados 'instalacao.log'
try { Start-Transcript -Path $Log -Append -Force | Out-Null } catch {}

trap {
  Write-Host "`n[ERRO] A instalacao parou: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registo: $Log" -ForegroundColor Yellow
  try { Stop-Transcript | Out-Null } catch {}
  exit 1
}

function AtualizarPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function ProcurarNode {
  $c = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) {
    if ($p -and (Test-Path $p)) { return $p }
  }
  return $null
}

# ------------------------------------------------------------------ 1. Node.js
Passo '1/8 Node.js'
AtualizarPath
$node = ProcurarNode
if ($node) {
  Feito "Ja instalado: $node ($(& $node --version)). Passo a frente."
} else {
  Info 'O Node.js nao esta instalado. A instalar a versao LTS...'
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($winget) {
    & winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements --scope machine
    AtualizarPath
    $node = ProcurarNode
  }
  if (-not $node) {
    Info 'A descarregar o instalador de nodejs.org...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json' -UseBasicParsing | Where-Object { $_.lts } | Select-Object -First 1).version
    $msi = Join-Path $env:TEMP "node-$lts-x64.msi"
    Invoke-WebRequest "https://nodejs.org/dist/$lts/node-$lts-x64.msi" -OutFile $msi -UseBasicParsing
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
    if ($p.ExitCode -notin 0, 3010) { throw "O instalador do Node.js falhou (codigo $($p.ExitCode))." }
    AtualizarPath
    $node = ProcurarNode
  }
  if (-not $node) { throw 'Nao foi possivel instalar o Node.js. Instale a versao LTS de https://nodejs.org e corra outra vez.' }
  Feito "Node.js instalado: $node ($(& $node --version))"
}
$npm = Join-Path (Split-Path $node) 'npm.cmd'
if (-not (Test-Path $npm)) { $npm = 'npm.cmd' }

# ------------------------------------------------------------------ 2. parar a versao antiga e instalar dependencias
Passo '2/8 Dependencias'
Unregister-ScheduledTask -TaskName $Tarefa -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" |
  Where-Object { $_.CommandLine -like '*servidor.js*' -or $_.CommandLine -like '*servico.cmd*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1
Push-Location $Pasta
try {
  & $npm install --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "O npm install falhou (codigo $LASTEXITCODE)." }
} finally { Pop-Location }
Feito 'Dependencias instaladas.'

# ------------------------------------------------------------------ 3. Excel
Passo '3/8 Excel'
$excel = Join-Path $Dados 'tempos.xlsx'
$antigo = Join-Path $Pasta 'tempos.xlsx'
if ((Test-Path $antigo) -and -not (Test-Path $excel)) {
  Copy-Item $antigo $excel
  Feito "Excel antigo copiado para $excel"
} elseif (Test-Path $excel) {
  Feito "Excel existente mantido: $excel"
} else {
  Feito "O Excel vai ser criado pelo servidor em $excel"
}
# Utilizadores normais podem abrir e alterar o Excel (o servidor corre como SYSTEM).
& icacls $Dados /grant '*S-1-5-32-545:(OI)(CI)M' /T /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Falha ao definir permissoes em $Dados." }

# ------------------------------------------------------------------ 4. servidor com o Windows
Passo '4/8 Servidor (arranca com o Windows)'
$ocupada = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 }
if ($ocupada) {
  Aviso "A porta $Porta esta ocupada por outro programa. A usar a porta 3000."
  $Porta = 3000
}
$sufixo = if ($Porta -eq 80) { '' } else { ":$Porta" }
$Url = "http://localhost$sufixo/gestao/"

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

$acao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$cmd`"" -WorkingDirectory $Pasta
# Arranca com o Windows e, como reserva, sempre que alguem entra (se ja estiver a correr, nao abre outro).
$quando = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn))
$quando[0].Delay = 'PT30S'  # dar tempo a rede e aos discos depois de ligar
$quem = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$regras = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $quando -Principal $quem -Settings $regras -Description "Pagina de gestao da INOVACAR com o Excel $excel" | Out-Null
Start-ScheduledTask -TaskName $Tarefa
Feito "Tarefa '$Tarefa' criada e iniciada (porta $Porta)."

# ------------------------------------------------------------------ 5. firewall
Passo '5/8 Firewall (telemoveis e outros computadores da oficina)'
Get-NetFirewallRule -DisplayName $Tarefa -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $Tarefa -Direction Inbound -Protocol TCP -LocalPort $Porta -Action Allow -Profile Private, Domain | Out-Null
$publicas = Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.NetworkCategory -eq 'Public' }
if ($publicas) {
  $publicas | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue
  Info 'Rede mudada de Publica para Privada (para os telemoveis conseguirem aceder).'
}
Feito "Porta $Porta aberta na rede local."

# ------------------------------------------------------------------ 6 e 7. abrir ao entrar + atalhos
Passo '6/8 Abrir a pagina ao entrar no Windows'
$abrir = Join-Path $Pasta 'abrir-pagina.ps1'
$icone = Join-Path $Pasta 'inovacar.ico'
if (-not (Test-Path $icone)) { $icone = "$env:SystemRoot\System32\shell32.dll,13" }
$shell = New-Object -ComObject WScript.Shell

function Atalho($caminho, $alvo, $argumentos, $icon, $janela = 1) {
  $s = $shell.CreateShortcut($caminho)
  $s.TargetPath = $alvo
  $s.Arguments = $argumentos
  $s.WorkingDirectory = $Pasta
  $s.IconLocation = $icon
  $s.WindowStyle = $janela
  $s.Save()
}

$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$argsAbrir = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$abrir`" -Url `"$Url`""

# Pasta Arranque de todos os utilizadores: corre sempre que alguem entra no Windows.
$arranque = [Environment]::GetFolderPath('CommonStartup')
Atalho (Join-Path $arranque 'INOVACAR Tempos.lnk') $psExe $argsAbrir $icone 7
Feito "Abre $Url sempre que alguem entrar no Windows."

Passo '7/8 Atalhos no Ambiente de Trabalho'
# Ambiente de Trabalho publico: os atalhos aparecem para todos os utilizadores deste computador.
$desktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
Atalho (Join-Path $desktop 'INOVACAR Tempos.lnk') $psExe $argsAbrir $icone 7
Atalho (Join-Path $desktop 'INOVACAR Excel.lnk') $excel '' "$env:SystemRoot\System32\shell32.dll,70"
Feito "Atalhos 'INOVACAR Tempos' (pagina) e 'INOVACAR Excel' criados em $desktop"

# ------------------------------------------------------------------ nome na rede (opcional)
$mudou = $false
if ($MudarNome -and $env:COMPUTERNAME -ne $Nome.ToUpper()) {
  Rename-Computer -NewName $Nome -Force
  $mudou = $true
}

# ------------------------------------------------------------------ 8. teste
Passo '8/8 Teste da pagina e do Excel'
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-RestMethod "http://localhost$sufixo/api" -Method Post -Body '{"action":"listar"}' -ContentType 'application/json' -TimeoutSec 5
    $ok = [bool]$r.ok
  } catch {}
}
if ($ok) {
  Feito "A pagina responde e esta ligada ao Excel ($excel)."
} else {
  Aviso "O servidor ainda nao respondeu. Veja $Dados\servidor.log"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
Write-Host "`n================ INOVACAR Tempos ================" -ForegroundColor Green
Write-Host "  Neste computador:   $Url"
if ($ip) { Write-Host "  Outros aparelhos:   http://$ip$sufixo/gestao/   (mesma rede)" }
Write-Host "  Excel:              $excel"
Write-Host "  Registo servidor:   $Dados\servidor.log"
if ($mudou) { Write-Host "`n  O nome $Nome fica ativo depois de reiniciar: http://$($Nome.ToLower())$sufixo/gestao/" -ForegroundColor Yellow }
Write-Host '  Feche o Excel depois de o consultar: com ele aberto a pagina nao consegue gravar.' -ForegroundColor Yellow

# Abrir pelo explorer para o browser nao ficar a correr como administrador.
if ($ok) { Start-Process explorer.exe $Url }
try { Stop-Transcript | Out-Null } catch {}
exit 0
