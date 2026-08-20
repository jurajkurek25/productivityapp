#!/usr/bin/env bash
# Stiahne najnovší kód pre balance.neoworkly.com (bez buildu/reštartu).
# Spusti na serveri v /home/neoworkly-balance/balance-app
set -euo pipefail

APP_DIR="/home/neoworkly-balance/balance-app"
BRANCH="claude/productivity-energy-adaptive-scheduler-qqxbcs"

cd "$APP_DIR"

echo "==> Git fetch ($BRANCH)"
git fetch origin "$BRANCH"

echo "==> Checkout"
git checkout "$BRANCH"

echo "==> Pull"
git pull origin "$BRANCH"

echo "==> Hotovo. Pre build + reštart spusti: bash deploy.sh"
