#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/data/emerald/emerald}"
MEDIA_DIR="${MEDIA_DIR:-/data/emerald/media}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
SERVICE_NAME="${SERVICE_NAME:-emerald}"
SERVICE_USER="${SERVICE_USER:-www-data}"
PORT="${PORT:-3000}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "[ERROR] APP_DIR not found: $APP_DIR"
  exit 1
fi

if [[ ! -d "$MEDIA_DIR" ]]; then
  echo "[ERROR] MEDIA_DIR not found: $MEDIA_DIR"
  exit 1
fi

if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "[ERROR] package.json not found in $APP_DIR"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Please run this script as root (sudo)."
  exit 1
fi

cd "$APP_DIR"

echo "[INFO] Ensuring env file exists: $ENV_FILE"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$APP_DIR/.env.example" ]]; then
    cp "$APP_DIR/.env.example" "$ENV_FILE"
    echo "[WARN] Created $ENV_FILE from .env.example."
    echo "[WARN] Please set secrets before exposing service publicly:"
    echo "       EMERALD_PORTAL_PASSWORD, EMERALD_PORTAL_COOKIE_SECRET, AWS_* if needed."
  else
    touch "$ENV_FILE"
  fi
fi

# Upsert EMERALD_LOCAL_MEDIA_DIR
if grep -q '^EMERALD_LOCAL_MEDIA_DIR=' "$ENV_FILE"; then
  sed -i.bak "s|^EMERALD_LOCAL_MEDIA_DIR=.*|EMERALD_LOCAL_MEDIA_DIR=$MEDIA_DIR|" "$ENV_FILE"
else
  echo "EMERALD_LOCAL_MEDIA_DIR=$MEDIA_DIR" >> "$ENV_FILE"
fi

echo "[INFO] Installing dependencies and building app"
npm ci
npm run build

echo "[INFO] Writing systemd service: /etc/systemd/system/${SERVICE_NAME}.service"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<SERVICE
[Unit]
Description=EMERALD Next.js Website
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/npm run start -- --port ${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# Ensure app directory readable by service user
chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "$MEDIA_DIR"

echo "[INFO] Reloading and restarting service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME" || true

echo "[INFO] Publish finished. App expected on localhost:${PORT}"
echo "[INFO] Next step: point nginx/caddy to http://127.0.0.1:${PORT}"
