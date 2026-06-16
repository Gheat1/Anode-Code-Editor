# Anode sync server

A tiny self-hosted backend for **Anode accounts + settings sync**, plus the
landing site for `gheat.net/anode`. Rust (axum) + SQLite, fronted by Caddy
behind Cloudflare.

```
server/
├── src/main.rs            # axum API: auth + settings
├── web/index.html         # landing page (gheat.net/anode)
├── Caddyfile              # reverse proxy + static serving
├── anode-sync.service     # systemd unit
├── Cargo.toml
└── .env.example
```

## API

Base URL in production: `https://gheat.net/anode/api`. Auth is a bearer token.

| Method | Path | Body | Returns |
| ------ | ---- | ---- | ------- |
| GET  | `/api/health` | — | `ok` |
| POST | `/api/auth/signup` | `{email,password}` | `{token,email}` |
| POST | `/api/auth/login`  | `{email,password}` | `{token,email}` |
| POST | `/api/auth/logout` | — (auth) | `{}` |
| GET  | `/api/me` | — (auth) | `{email}` |
| GET  | `/api/settings` | — (auth) | `{data,updated_at}` |
| PUT  | `/api/settings` | `{data}` (auth) | `{updated_at}` |

`data` is Anode's settings blob (arbitrary JSON). Passwords are Argon2id hashed;
tokens are random and stored only as their SHA-256 hash.

## Run locally

```bash
cd server
cargo run                      # listens on 127.0.0.1:8787, db ./anode.db
curl localhost:8787/api/health # -> ok
```

Config via env: `ANODE_BIND` (default `127.0.0.1:8787`), `ANODE_DB` (default
`anode.db`).

## Deploy on Arch

This assumes Caddy already serves `gheat.net` from `/var/www/Gheat.net` (TLS at
Cloudflare, Caddy on `:80`).

```bash
# 1. build the server (on the box, or copy the binary over)
sudo pacman -S --needed rust
cd server && cargo build --release      # -> target/release/anode-sync

# 2a. the API server lives in /srv/anode (binary + sqlite db)
sudo useradd -r -s /usr/bin/nologin anode
sudo mkdir -p /srv/anode
sudo cp target/release/anode-sync /srv/anode/
sudo chown -R anode:anode /srv/anode

# 2b. the landing site goes under your existing webroot
sudo mkdir -p /var/www/Gheat.net/anode
sudo cp web/index.html /var/www/Gheat.net/anode/
# drop your Windows build here so the download button works:
sudo cp /path/to/Anode_1.3.3_x64-setup.exe /var/www/Gheat.net/anode/Anode.exe

# 3. service
sudo cp anode-sync.service /etc/systemd/system/
sudo systemctl enable --now anode-sync
systemctl status anode-sync

# 4. Caddy — add the one API block from ./Caddyfile into your existing
#    `gheat.net:80 { ... }` block (the static site is already served by your
#    catch-all `handle /*`). Then:
sudo systemctl reload caddy

# 5. check
curl https://gheat.net/anode/api/health   # -> ok
```

### Cloudflare / TLS
You're already terminating TLS at Cloudflare with Caddy on `:80`, so there's
nothing to add for HTTPS. Just make sure Cloudflare doesn't cache the API: the
`Cache-Control: no-store` header in the Caddy block handles it, but a cache rule
**bypassing `/anode/api/*`** is good belt-and-suspenders.

## How the app uses it
The desktop app talks to `https://gheat.net/anode/api` from **Settings → Account
Sync** (`src/lib/account.ts`). Override the base URL at build time with
`VITE_ANODE_API`. Auth is a bearer token kept in the app's `localStorage`
(`anode-account-token`); settings are pushed/pulled as the whole settings blob.

CORS is permissive on the server (safe because auth is a header token, not a
cookie).

## Backups
Everything is in one SQLite file. Snapshot it live with:
```bash
sqlite3 /srv/anode/anode.db ".backup /srv/anode/backup-$(date +%F).db"
```
