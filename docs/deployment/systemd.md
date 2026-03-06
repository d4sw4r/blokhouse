# systemd Service

Run Blokhouse as a managed systemd service so it starts on boot and restarts on failure.

> This applies to the **install script** (Node.js) setup. For Docker, use `docker compose up -d --restart always` instead.

## Service File

Create `/etc/systemd/system/blokhouse.service`:

```ini
[Unit]
Description=Blokhouse CMDB
Documentation=https://github.com/d4sw4r/blokhouse
After=network.target

[Service]
Type=simple
User=blokhouse
WorkingDirectory=/opt/blokhouse
EnvironmentFile=/opt/blokhouse/.env
ExecStart=/usr/bin/node node_modules/.bin/next start
Restart=on-failure
RestartSec=5s

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=blokhouse

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

## Setup

```bash
# Create a dedicated system user
sudo useradd --system --no-create-home --shell /usr/sbin/nologin blokhouse

# Set ownership
sudo chown -R blokhouse:blokhouse /opt/blokhouse

# Install and enable the service
sudo cp blokhouse.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now blokhouse
```

## Managing the Service

```bash
# Status
sudo systemctl status blokhouse

# Logs (live)
sudo journalctl -u blokhouse -f

# Restart
sudo systemctl restart blokhouse

# Stop
sudo systemctl stop blokhouse
```

## Updating Blokhouse

```bash
cd /opt/blokhouse
sudo systemctl stop blokhouse
sudo -u blokhouse git pull origin main
sudo -u blokhouse npm install
sudo -u blokhouse npm run build
sudo systemctl start blokhouse
```
