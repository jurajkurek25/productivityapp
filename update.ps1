#!/usr/bin/env pwsh
# Update skript pre balance.neoworkly.com
# Spusti na serveri: pwsh ./update.ps1

$ErrorActionPreference = "Stop"

$AppDir = "/home/neoworkly-balance/htdocs/balance.neoworkly.com"
$Branch = "claude/productivity-energy-adaptive-scheduler-qqxbcs"
$Pm2Name = "balance-api"

function Invoke-Step {
    param([string]$Description, [scriptblock]$Action)
    Write-Host "==> $Description"
    & $Action
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        throw "Krok zlyhal: $Description (exit code $LASTEXITCODE)"
    }
}

Set-Location $AppDir

Invoke-Step "Git fetch ($Branch)" { git fetch origin $Branch }
Invoke-Step "Checkout" { git checkout $Branch }
Invoke-Step "Pull" { git pull origin $Branch }

Invoke-Step "Aktivujem pnpm cez corepack" { corepack prepare pnpm@10.33.0 --activate }
Invoke-Step "Instalujem zavislosti" { pnpm install --frozen-lockfile }

Write-Host "==> Prisma generate + db push"
Set-Location (Join-Path $AppDir "apps/server")
Invoke-Step "Prisma generate" { pnpm exec prisma generate }
Invoke-Step "Prisma db push" { pnpm exec prisma db push }
Set-Location $AppDir

Invoke-Step "Build packages/core" { pnpm run build }
Invoke-Step "Build server" { pnpm --filter server build }
Invoke-Step "Build web" { pnpm --filter web build }

Write-Host "==> Restart pm2 procesu ($Pm2Name)"
pm2 describe $Pm2Name *> $null
if ($LASTEXITCODE -eq 0) {
    Invoke-Step "pm2 restart" { pm2 restart $Pm2Name --update-env }
} else {
    Write-Host "Proces '$Pm2Name' v pm2 neexistuje, spustam novy."
    Set-Location (Join-Path $AppDir "apps/server")
    Invoke-Step "pm2 start" { pm2 start dist/index.js --name $Pm2Name }
    Set-Location $AppDir
}

pm2 save

Write-Host "==> Hotovo. Status:"
pm2 status $Pm2Name

Start-Sleep -Seconds 1
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4321/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host $response.StatusCode
} catch {
    Write-Host "Health check zlyhal — skontroluj 'pm2 logs $Pm2Name'"
}
