# Aarogya Drishti — Operational Runbook & Deployment Guide

> **Audience:** System administrators, devops engineers, medical officers, and technical maintainers operating Aarogya Drishti in rural and district healthcare environments (ITDA Paderu, Andhra Pradesh).

---

## 1. System Architecture & Topology

Aarogya Drishti is engineered as an **offline-first, zero-NPM-dependency Node.js (v24.20.0+)** healthcare service. It is designed to run reliably on edge hardware (such as a local mini-server in Area Hospital Paderu or CHC Araku) or a centralized district server.

```
       [ Rural Field Tablets / Handsets ]
           (ASHA / ANM Offline Intakes)
                      │
           (Cellular / Wi-Fi Sync)
                      ▼
 ┌─────────────────────────────────────────────────────────┐
 │               Edge Gateway / Reverse Proxy              │
 │                   (Caddy / Nginx)                       │
 │        SSL/TLS Termination · Rate Limit · WAF           │
 └────────────────────────────┬────────────────────────────┘
                              │ Reverse Proxy (:8080)
 ┌────────────────────────────▼────────────────────────────┐
 │              Aarogya Drishti Node.js Host               │
 │                                                         │
 │  ┌───────────────────────────────────────────────────┐  │
 │  │ API Engine: Auth · Consents · Clinical Reviews    │  │
 │  └─────────────────────────┬─────────────────────────┘  │
 │                            │                            │
 │  ┌─────────────────────────┴─────────────────────────┐  │
 │  │ SQLite Database Engine (WAL Mode)                 │  │
 │  │ file: .local/drishti.sqlite                       │  │
 │  └───────────────────────────────────────────────────┘  │
 │                            │                            │
 │  ┌─────────────────────────┴─────────────────────────┐  │
 │  │ Decoupled Secure Image Store (chmod 0o600)        │  │
 │  │ dir: .local/storage/images/                       │  │
 │  └───────────────────────────────────────────────────┘  │
 │                            │                            │
 │  ┌─────────────────────────┴─────────────────────────┐  │
 │  │ AI Inference Framework: SigLIP-2 / Umlomo Adapter │  │
 │  └───────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────┘
```

---

## 2. Environment Configuration Reference

All settings can be configured via environment variables or a local `.env` file in the project root.

| Variable | Type | Default | Description | Production Guidance |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Integer | `8080` | HTTP listening port. | Set to `8080` behind a reverse proxy. |
| `HOST` | String | `127.0.0.1` | Network interface to bind. | Keep `127.0.0.1` when using Nginx/Caddy. Use `0.0.0.0` only for direct LAN testing. |
| `LAN_HOST` | String | `null` | IP or hostname for local network worker access. | Set to edge server IP (e.g. `192.168.1.50`) if field workers connect over hospital Wi-Fi. |
| `COOKIE_SECURE` | Boolean | `false` | Enforce `Secure` flag on session cookies. | **Must be `true`** in production when served over HTTPS. |
| `DATA_DIR` | Path | `.local` | Directory for SQLite DB and user accounts. | Map to persistent, backed-up storage (e.g. `/var/lib/aarogya-drishti/data`). |
| `STORAGE_DIR` | Path | `.local/storage` | Directory for private oral photography disk storage. | Map to dedicated volume with restrictive permissions (`chmod 0700`). |
| `AI_MODEL_ID` | String | `mock-multiclass` | Active AI model adapter ID. | Use `siglip2-tooth-agenesis` or `umlomo-oral-cancer` if PyTorch is installed. |
| `N8N_EVENTS_URL` | URL | `null` | Outbound n8n webhook for SMS/care coordination. | Set to local or cloud n8n webhook intake URL. |
| `N8N_CALLBACK_TOKEN`| String | `null` | Shared secret token for incoming n8n automation callbacks. | Generate a high-entropy 32-character string. |
| `TRUST_CLOUDFLARE` | Boolean | `false` | Trust `CF-Connecting-IP` headers for rate limiting. | Set to `true` only if deployed behind Cloudflare Tunnel. |

---

## 3. Production Deployment Guide

### Option A: Systemd Service (Linux Ubuntu / Debian Server)

Create the dedicated system service file at `/etc/systemd/system/aarogya-drishti.service`:

```ini
[Unit]
Description=Aarogya Drishti Oral Healthcare Platform
After=network.target

[Service]
Type=simple
User=drishti
Group=drishti
WorkingDirectory=/opt/aarogya-drishti
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=HOST=127.0.0.1
Environment=COOKIE_SECURE=true
Environment=DATA_DIR=/var/lib/aarogya-drishti/data
Environment=STORAGE_DIR=/var/lib/aarogya-drishti/storage
Environment=AI_MODEL_ID=mock-multiclass
ExecStart=/usr/bin/node /opt/aarogya-drishti/server.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable aarogya-drishti
sudo systemctl start aarogya-drishti
sudo systemctl status aarogya-drishti
```

---

### Option B: Reverse Proxy Configurations

#### 1. Caddy (Recommended for Auto-HTTPS)
Create `/etc/caddy/Caddyfile`:

```caddy
drishti.paderu.gov.in {
    encode gzip zstd
    
    # Security Headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "no-referrer"
    }

    # Proxy to Node.js backend
    reverse_proxy 127.0.0.1:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

#### 2. Nginx
Create `/etc/nginx/sites-available/aarogya-drishti`:

```nginx
server {
    listen 80;
    server_name drishti.paderu.gov.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name drishti.paderu.gov.in;

    ssl_certificate /etc/letsencrypt/live/drishti.paderu.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/drishti.paderu.gov.in/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
```

---

## 4. Disaster Recovery & Automated Backup Runbook

Aarogya Drishti includes an integrated backup and restoration CLI tool in `scripts/backup-restore.mjs`.

### Target Objectives:
* **Recovery Time Objective (RTO):** $< 15\text{ minutes}$.
* **Recovery Point Objective (RPO):** $< 24\text{ hours}$ (Daily scheduled backup).

### Automated Daily Cron Backup:
Add this line to `/etc/cron.d/aarogya-backup` (or root crontab):
```bash
# Run daily backup at 02:00 AM UTC
0 2 * * * drishti node /opt/aarogya-drishti/scripts/backup-restore.mjs backup /var/backups/drishti >> /var/log/drishti-backup.log 2>&1
```

### Manual Backup Command:
```bash
node scripts/backup-restore.mjs backup /var/backups/drishti
```
Output:
```
[BACKUP] Starting backup into /var/backups/drishti...
[BACKUP] ✓ Success! Created backup-20261029-170000-123
[BACKUP] Path: /var/backups/drishti/backup-20261029-170000-123
[BACKUP] Patients: 142, Referrals: 38, Images: 120
```

### Dry-Run Verification Command:
Before restoring any backup, verify its cryptographic checksums and SQLite integrity:
```bash
node scripts/backup-restore.mjs verify /var/backups/drishti/backup-20261029-170000-123
```
Output:
```
[VERIFY] Verifying backup /var/backups/drishti/backup-20261029-170000-123...
[VERIFY] ✓ Valid! Verified 122 files.
[VERIFY] Created at: 2026-10-29T17:00:00.123Z
```

### Disaster Recovery Restoration Playbook:
If edge hardware suffers drive corruption or accidental deletion:

1. **Stop the active service:**
   ```bash
   sudo systemctl stop aarogya-drishti
   ```
2. **Verify target backup archive integrity:**
   ```bash
   node scripts/backup-restore.mjs verify /var/backups/drishti/backup-TARGET
   ```
3. **Execute restoration:**
   ```bash
   node scripts/backup-restore.mjs restore /var/backups/drishti/backup-TARGET
   ```
4. **Restart the service:**
   ```bash
   sudo systemctl start aarogya-drishti
   ```
5. **Verify health endpoint:**
   ```bash
   curl -s http://127.0.0.1:8080/health | jq .
   ```

---

## 5. Health Monitoring & Observability

### Endpoint: `GET /health`
The health endpoint provides real-time health data for monitoring tools (Prometheus, Nagios, Datadog, Uptime Kuma):

```bash
curl -s http://localhost:8080/health
```

Example JSON response:
```json
{
  "status": "healthy",
  "version": "0.3.0",
  "uptime": 1420.5,
  "database": {
    "status": "connected",
    "migrationVersion": 6
  },
  "storage": {
    "status": "writable",
    "storageDir": ".local/storage",
    "imagesCount": 120
  },
  "ai": {
    "status": "ready",
    "activeModel": "mock-multiclass"
  }
}
```

### Security Audit Querying
To inspect administrative actions or audit trail logs:
```bash
# Query the 10 most recent clinical actions in SQLite
sqlite3 .local/drishti.sqlite "SELECT actor, action, record_id, at FROM audit ORDER BY id DESC LIMIT 10;"
```

---

## 6. Pre-Flight Operational Checklist

Before declaring a field deployment ready for clinical use at an ITDA facility:

- [ ] Node.js v24+ runtime verified (`node --version`).
- [ ] Database initialized with WAL mode enabled (`PRAGMA journal_mode = WAL;`).
- [ ] Automatic daily backups configured in cron.
- [ ] Decoupled image directory restricted to `0o700` / `0o600` permissions.
- [ ] Reverse proxy enforces TLS 1.3 with HTTPS `Strict-Transport-Security`.
- [ ] Initial demo accounts rotated or passwords updated for field staff.
- [ ] `GET /health` returns `"status": "healthy"`.
- [ ] Test backup verification passes (`node scripts/backup-restore.mjs verify <dir>`).
