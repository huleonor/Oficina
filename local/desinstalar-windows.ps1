# INOVACAR Tempos: tira o arranque automatico, a regra da firewall e os atalhos. O Excel (C:\INOVACAR\dados) fica.
# Ficheiro so com caracteres ASCII de proposito (o PowerShell 5 do Windows le mal acentos sem BOM).
$ErrorActionPreference = 'Continue'
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""; exit }
$Tarefa = 'INOVACAR Tempos'
Stop-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $Tarefa -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='cmd.exe' OR Name='node.exe'" | Where-Object { $_.CommandLine -like '*servico.cmd*' -or $_.CommandLine -like '*servidor.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-NetFirewallRule -DisplayName $Tarefa -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$atalhos = @(
  (Join-Path ([Environment]::GetFolderPath('CommonStartup')) 'INOVACAR Tempos.lnk'),
  (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'INOVACAR Tempos.lnk'),
  (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'INOVACAR Excel.lnk')
)
$atalhos | Where-Object { Test-Path $_ } | Remove-Item -Force
Write-Host 'Desinstalado. O Excel ficou em C:\INOVACAR\dados.'
Read-Host 'Enter para fechar'
