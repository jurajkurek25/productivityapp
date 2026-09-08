#!/usr/bin/env bash
# Deploy script pre balance.neoworkly.com
# Spusti na serveri v /home/neoworkly-balance/balance-app
set -euo pipefail

APP_DIR="/home/neoworkly-balance/balance-app"
BRANCH="claude/productivity-energy-adaptive-scheduler-qqxbcs"
PM2_NAME="balance-api"

cd "$APP_DIR"

echo "==> Git pull ($BRANCH)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Aktivujem pnpm cez corepack"
corepack prepare pnpm@10.33.0 --activate

echo "==> Inštalujem závislosti"
pnpm install --frozen-lockfile

echo "==> Prisma generate + db push"
cd apps/server
pnpm exec prisma generate
pnpm exec prisma db push
cd "$APP_DIR"

echo "==> Build packages/core"
pnpm run build

echo "==> Build server"
pnpm --filter server build

echo "==> Build web"
pnpm --filter web build

echo "==> Reštart pm2 procesu ($PM2_NAME)"
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  echo "Proces '$PM2_NAME' v pm2 neexistuje, spúšťam nový."
  cd apps/server
  pm2 start dist/index.js --name "$PM2_NAME"
  cd "$APP_DIR"
fi

pm2 save

echo "==> Hotovo. Status:"
pm2 status "$PM2_NAME"
sleep 1
curl -sf http://localhost:4321/api/health && echo || echo "Health check zlyhal — skontroluj 'pm2 logs $PM2_NAME'"
