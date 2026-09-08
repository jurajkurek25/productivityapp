#!/usr/bin/env pwsh
# Spusti LOKÁLNE (na svojom počítači) — pripojí sa cez SSH na server
# a spustí update.ps1 priamo tam. Vyžaduje nainštalovaný OpenSSH klient
# (na Windows je súčasťou systému, na Linux/Mac tiež) a SSH kľúč/heslo
# nastavené tak, aby si sa vedel prihlásiť bez tohto skriptu.

$SshHost = "DOPLN_HOST_ALEBO_IP"   # napr. balance.neoworkly.com alebo IP servera
$SshUser = "root"                    # SSH používateľ
$AppDir  = "/home/neoworkly-balance/balance-app"

$ErrorActionPreference = "Stop"

if ($SshHost -eq "DOPLN_HOST_ALEBO_IP") {
    throw "Najprv over premennu `$SshHost hore v skripte na skutočnú adresu servera."
}

Write-Host "==> Pripajam sa na $SshUser@$SshHost a spustam update.ps1"
ssh "$SshUser@$SshHost" "cd $AppDir && pwsh ./update.ps1"
if ($LASTEXITCODE -ne 0) {
    throw "Vzdialeny deploy zlyhal (exit code $LASTEXITCODE)"
}

Write-Host "==> Hotovo."
