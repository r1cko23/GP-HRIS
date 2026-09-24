# Step-by-step: local Supabase server + apps on your PCs

Follow this **in order**. Do not skip ahead.

You will:

1. Prepare the Ubuntu server (disks + Docker)
2. Install Supabase for **GP-HRIS** first
3. Load the HRIS database schema
4. Run GP-HRIS on a computer and connect it
5. (Later) Add CSM and GP-Client the same way

**This office server (already checked):**

| | |
|---|---|
| Hostname | `gp-hris` |
| SSH | `ssh admin-gp@10.0.0.110` |
| LAN IP (use this) | `10.0.0.110` |
| Other IP (ignore for apps) | `10.1.173.128` |
| RAM | ~30 GB |
| Status | **Production on server live:** 3 Supabase stacks + 3 Next apps + nginx; backups on HDD |

Use `10.0.0.110` everywhere below (not `192.168.x.x`).

**IP mode (checked):** currently **DHCP on Wi‑Fi** (`wlp0s20f3`). Pin it before Supabase (Step 1b).

---

# Part A — On the Ubuntu server

## Step 1. Log in and confirm IP

From your Mac:

```bash
ssh admin-gp@10.0.0.110
hostname -I
```

You should see `10.0.0.110` (and maybe `10.1.173.128`).

## Step 1b. Make `10.0.0.110` static

Pick **one**:

**A — Router DHCP reservation (easiest)**  
Reserve Wi‑Fi MAC `d0:57:7e:b8:48:a4` → always `10.0.0.110`. No server edit.

**B — Static IP in Ubuntu netplan**  
On the server (console or SSH), with sudo:

```bash
sudo cp /etc/netplan/00-installer-config.yaml /etc/netplan/00-installer-config.yaml.bak
sudo nano /etc/netplan/00-installer-config.yaml
```

Under `wlp0s20f3`, change DHCP to static. **Keep** the existing `access-points:` / Wi‑Fi password block. Example shape:

```yaml
wifis:
  wlp0s20f3:
    dhcp4: false
    addresses:
      - 10.0.0.110/24
    routes:
      - to: default
        via: 10.0.0.1
    nameservers:
      addresses: [8.8.8.8, 1.1.1.1]
    access-points:
      "YOUR_WIFI_NAME":
        password: "YOUR_WIFI_PASSWORD"
```

Then:

```bash
sudo netplan try
# if OK within 120s it keeps the change; else it rolls back
```

Confirm from your Mac:

```bash
ssh admin-gp@10.0.0.110 'ip -br addr; ip route | head -3'
```

Default route should **not** say `proto dhcp` anymore.

**Better later:** plug Ethernet into `enp4s0` and put the static IP on cable instead of Wi‑Fi.

---

## Step 2. Mount the SSD and HDD

Goal:

- **SSD** = live database + apps (fast)
- **HDD** = backups + infrequent 201 scan blobs (`employee-documents`)

```bash
lsblk
```

Mount them (device names may differ — use what `lsblk` shows):

```bash
sudo mkdir -p /mnt/ssd /mnt/hdd
# Example only — change sdX to your disks:
# sudo mount /dev/sdX1 /mnt/ssd
# sudo mount /dev/sdY1 /mnt/hdd
```

Add the same mounts to `/etc/fstab` so they survive reboot. Then:

```bash
sudo mkdir -p /mnt/ssd/docker /mnt/ssd/supabase /mnt/hdd/backups/supabase
sudo chown "$USER:$USER" /mnt/ssd/docker /mnt/ssd/supabase /mnt/hdd/backups
```

**Check:** `df -h /mnt/ssd /mnt/hdd` shows both disks.

---

## Step 3. Install Docker and point it at the SSD

```bash
sudo apt update
sudo apt install -y curl git ca-certificates
```

Tell Docker to store data on the SSD:

```bash
sudo mkdir -p /etc/docker
echo '{ "data-root": "/mnt/ssd/docker" }' | sudo tee /etc/docker/daemon.json
```

Install Supabase (this also installs Docker if needed):

```bash
cd /mnt/ssd/supabase
curl -fsSL https://supabase.link/setup.sh | sh
```

When it asks for URLs, enter (use your IP):

```text
http://10.0.0.110:8000
```

for the main / public / API URL questions.

Rename the folder so it is clear:

```bash
mv supabase-project hris
cd hris
```

---

## Step 4. Start Supabase (HRIS database)

```bash
cd /mnt/ssd/supabase/hris
sh run.sh start
```

Save the passwords and keys:

```bash
sh run.sh secrets
```

Copy these into a password manager **now**:

- Studio / dashboard password
- `anon` key
- `service_role` key

**Check it works on the server:**

```bash
docker compose ps
curl -I http://127.0.0.1:8000
```

You should see containers running and an HTTP response (not “connection refused”).

---

## Step 5. Open the firewall for office computers

```bash
sudo ufw allow OpenSSH
sudo ufw allow from 10.0.0.0/24 to any port 8000 proto tcp
sudo ufw enable
sudo ufw status
```

Office LAN looks like `10.0.0.0/24` (your Mac and this server). Tighten further if you know a smaller range.

**Do not** open port 8000 to the whole internet.

**Check from a laptop on Wi‑Fi/LAN:**

In a browser open:

```text
http://10.0.0.110:8000
```

You should reach Supabase (API or Studio, depending on version). If it fails, fix network/firewall before continuing.

---

## Step 6. Create your admin login in Studio

1. Open Studio in the browser (URL from Step 4 / Supabase docs for your install).
2. Log in with the dashboard password from `sh run.sh secrets`.
3. Go to **Authentication → Users → Add user**.
4. Enter your email + password.
5. Turn **Auto Confirm** on.
6. Create the user.

Keep that email/password — you will use it to log into GP-HRIS.

---

# Part B — On your computer (Mac / Windows / Linux)

## Step 7. Install Node.js

Install **Node.js 20 LTS** from [https://nodejs.org](https://nodejs.org).

Check:

```bash
node -v
npm -v
```

Both should print a version.

---

## Step 8. Get the GP-HRIS code

```bash
cd ~/Desktop/Green\ Pasture
# If you already have the folder, skip clone:
# git clone <your-repo-url> GP-HRIS
cd GP-HRIS
npm install
```

---

## Step 9. Point the app at your server

Create a file named `.env.local` in the `GP-HRIS` folder:

```env
NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.110:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DIRECTORY_SERVICE_API_KEY=make-one-with-openssl-rand-hex-32
```

Make the Directory key once (on any machine):

```bash
openssl rand -hex 32
```

Paste that value into `DIRECTORY_SERVICE_API_KEY`.

Use the **anon** and **service_role** keys from Step 4 (server).

---

## Step 10. Allow localhost login redirects

In Supabase Studio (HRIS) → **Authentication → URL configuration**:

Add:

```text
http://localhost:3000/**
http://localhost:3000/reset-password
```

Save.

---

## Step 11. Load the database tables (migrations)

Still in Studio → **SQL Editor**.

You must run the SQL files from:

```text
GP-HRIS/supabase/migrations/
```

**In filename order** (001, then 002, … then 202, 203, …).

Practical approach for a first install:

1. Start from the earliest migration files and work forward, **or**
2. Ask someone who already applied them on cloud to export / help apply the current set.

After migrations finish, confirm in Studio → **Table Editor** that schemas like `public` and `directory` exist.

---

## Step 12. Start the app

```bash
cd ~/Desktop/Green\ Pasture/GP-HRIS
npm run dev
```

Open:

```text
http://localhost:3000
```

Log in with the user from Step 6.

**If login fails:** wrong keys, wrong `NEXT_PUBLIC_SUPABASE_URL`, or Auth redirect URLs missing (Steps 9–10).

**If the page loads but data errors:** migrations not applied yet (Step 11).

---

# Part C — Done for HRIS. Optional next apps

Only do this after Part A + B work.

## Step 13. Second database for CSM (on the server)

```bash
cd /mnt/ssd/supabase
cp -a hris csm
cd csm
```

Edit `.env` so this stack uses **port 8100** (not 8000), and **new** secrets (do not reuse HRIS JWT keys).

Then:

```bash
COMPOSE_PROJECT_NAME=supabase-csm docker compose up -d
# or: sh run.sh start   if your copy still has run.sh and unique ports
```

Open firewall for 8100 the same way as Step 5.

Save CSM anon + service_role keys.

---

## Step 14. Run CSM on a computer

```bash
cd ~/Desktop/CSM-GP
cp .env.example .env.local
npm install
```

Put in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.110:8100
NEXT_PUBLIC_SUPABASE_ANON_KEY=csm-anon-key
SUPABASE_SERVICE_ROLE_KEY=csm-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3003
DIRECTORY_API_BASE_URL=http://localhost:3000
DIRECTORY_SERVICE_API_KEY=same-key-as-hris
DIRECTORY_ORGANIZATION_ID=paste-org-uuid-from-directory
```

Apply CSM migrations from `CSM-GP/supabase/migrations/` (order in that repo’s README).

```bash
npm run dev
```

Open `http://localhost:3003`.

**GP-HRIS must also be running** on `:3000` for Directory calls.

---

## Step 15. Third database for GP-Client (on the server)

Same pattern as Step 13, folder `client`, port **8200**.

---

## Step 16. Run GP-Client on a computer

```bash
cd ~/Desktop/Green\ Pasture/GP-Client-Attendance-Payroll
cp .env.example .env.local
npm install
```

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.110:8200
NEXT_PUBLIC_SUPABASE_ANON_KEY=client-anon-key
SUPABASE_SERVICE_ROLE_KEY=client-service-role-key
DIRECTORY_API_BASE_URL=http://localhost:3000
DIRECTORY_SERVICE_API_KEY=same-key-as-hris
DIRECTORY_ORGANIZATION_ID=same-org-uuid
CSM_API_BASE_URL=http://localhost:3003
```

```bash
npx next dev -p 3001
```

Open `http://localhost:3001`.

For full Deployed flow you need **HRIS + CSM + Client** all running.

---

# Part D — Disk tiers, backups, cold docs, GREENHRISMAIN ETL

## D1. What lives where

| Path | Disk | Contents |
|---|---|---|
| `/mnt/ssd/docker` | SSD | Docker data-root (live Postgres for all three stacks) |
| `/mnt/ssd/supabase/{hris,csm,client}` | SSD | Compose + hot volumes |
| `/mnt/ssd/apps/*` | SSD | Next apps (`gp-hris`, `csm-gp`, `gp-client`) |
| `/mnt/ssd/redis` | SSD | Shared Redis |
| `/mnt/hdd/backups/supabase` | HDD | Nightly `pg_dump -Fc` (14-day retain) |
| `/mnt/hdd/storage/employee-documents` | HDD | Infrequent 201 scans (SSS / TIN / PhilHealth / Pag-IBIG / IDs) |
| `/mnt/hdd/logs/cron` | HDD | Backup + ETL cron logs |

**Hot (SSD):** roster queries, cutoff hub, Auth, clock, Redis.  
**Cold (HDD):** dump files + scan **blobs**. Statutory **numbers** (`tin`, `sss_number`, …) stay in Postgres on SSD; only the `employee-documents` bucket files go to HDD.

Canonical scripts (copy to `~/bin/` on the server): [`docs/setup/cron/`](cron/).

## D2. Nightly database backups

```bash
mkdir -p /mnt/hdd/backups/supabase /mnt/hdd/logs/cron
cp docs/setup/cron/backup-supabase.sh docs/setup/cron/verify-backups.sh ~/bin/
chmod +x ~/bin/backup-supabase.sh ~/bin/verify-backups.sh
# Manual once:
sg docker -c /home/admin-gp/bin/backup-supabase.sh
```

Dumps containers `supabase-db`, `supabase-csm-db`, `supabase-client-db` → `/mnt/hdd/backups/supabase/{hris,csm,client}-YYYY-MM-DD.dump`.

## D3. Cold storage — `employee-documents` on HDD

One-time on `gp-hris` (symlink via Docker so root-owned `volumes/storage` does not need sudo; falls back to bind-mount + fstab):

```bash
cp docs/setup/cron/mount-employee-documents-hdd.sh ~/bin/
chmod +x ~/bin/mount-employee-documents-hdd.sh
~/bin/mount-employee-documents-hdd.sh
```

Confirm with `ls -la /mnt/ssd/supabase/hris/volumes/storage/employee-documents` (symlink → `/mnt/hdd/storage/employee-documents`). Profile pictures and other small hot buckets stay on SSD under `volumes/storage/`.

## D4. GREENHRISMAIN → local Directory (new 201s)

Read-only pull from SQL Server (`10.0.0.167` / `GREENHRISMAIN`) into local Supabase behind `https://hris.greenpasture.com`. Uses `npm run etl:directory:new-only` (`--new-only --apply`: INSERT missing people + 201 children; **never** updates existing rows / CSM engagement). Do **not** cron full `etl:directory:apply`.

```bash
cp docs/setup/cron/etl-env.sh \
   docs/setup/cron/etl-directory-new-only.sh \
   docs/setup/cron/etl-directory-departments.sh \
   ~/bin/
chmod +x ~/bin/etl-*.sh
# Dry-run once (from app dir, with SQL_* in .env.production.local):
cd /mnt/ssd/apps/gp-hris && npm run etl:directory:new-only:dry
# Then enable apply via cron (wrapper runs --apply).
```

Wrappers load `.env.local` + `.env.production.local` (where `SQL_*` live), set `NODE_EXTRA_CA_CERTS=/etc/ssl/gp/ca.crt` for the local HTTPS CA, and use `flock` so overlapping runs skip. Optional: `ETL_SUPABASE_URL=http://127.0.0.1:8000` to hit Kong over loopback.

## D5. Crontab (`CRON_TZ=Asia/Manila`)

Server clock may be UTC; keep schedules in Manila office time:

```bash
mkdir -p /mnt/hdd/logs/cron
crontab -e
# paste from docs/setup/cron/crontab.example
```

| When (Manila) | Job |
|---|---|
| `15 2 * * *` | Nightly DB backup (hris + csm + client) |
| `0 4 * * 0` | Weekly `pg_restore -l` verify |
| `*/30 7-19 * * 1-6` | New 201 ETL from GREENHRISMAIN |
| `0 6 * * 1` | Weekly departments catalog |
| `*/10 8-20 * * 1-6` | **TEMP** merge sync cloud (.ph Vercel) ↔ local (.com) — disable after Cloudflare Tunnel cutover |

### Remote access: Cloudflare Tunnel (`.ph` → local DB)

**Target:** AS and WFH use `*.greenpasture.ph`; office LAN keeps `*.greenpasture.com`. Both hit the **same** on-prem apps/Kong/Postgres. See [cloudflare-tunnel/README.md](./cloudflare-tunnel/README.md).

Until the tunnel is live, the TEMP merge sync below bridges Vercel cloud and local.

### TEMP — merge sync cloud (.ph Vercel) ↔ local (.com) (until Cloudflare Tunnel)

While deployed AS still write **cloud** Vercel/Supabase (`csm.greenpasture.ph` on Vercel) and the office uses on-prem (`.com` → `10.0.0.110`), cron **merges** the three stacks (hris + csm + client) every 10 minutes (Mon–Sat 08:00–20:00 Manila). Overlapping runs are skipped via flock.

**Semantics:** insert-only both ways — each side gets rows whose primary key is missing on that side. Same PK already present is left alone (never overwritten). Deletes do not propagate. Storage file blobs are not synced.

**How it stays fast:** per table it pulls remote **PK columns only**, diffs locally, then fetches/inserts **full rows only for missing PKs**. Generated columns are skipped. Covers all three stacks (hris + csm + client).

```bash
sudo apt-get install -y postgresql-client
sudo install -d -m 750 -o admin-gp -g admin-gp /mnt/ssd/secrets
# create /mnt/ssd/secrets/cloud-sync.env from docs/setup/cron/cloud-sync.env.example (chmod 600)
# Live: DRY_RUN=0, MERGE_CLOUD_TO_LOCAL=1, MERGE_LOCAL_TO_CLOUD=1
cp docs/setup/cron/sync-merge-cloud-local.sh ~/bin/ && chmod +x ~/bin/sync-merge-cloud-local.sh
cp docs/setup/cron/sync-cloud-to-local-OVERWRITE.sh ~/bin/ && chmod +x ~/bin/sync-cloud-to-local-OVERWRITE.sh
# passwordless systemctl only needed for the emergency overwrite script:
echo 'admin-gp ALL=(root) NOPASSWD: /bin/systemctl stop gp-hris, /bin/systemctl stop csm-gp, /bin/systemctl stop gp-client, /bin/systemctl start gp-hris, /bin/systemctl start csm-gp, /bin/systemctl start gp-client' | sudo tee /etc/sudoers.d/gp-cloud-sync
sudo chmod 440 /etc/sudoers.d/gp-cloud-sync
# then enable the merge line in crontab.example
```

**Rollout:** (1) `DRY_RUN=1` — review `would_insert=` counts in `/mnt/hdd/logs/cron/sync-merge-cloud-local.log`. (2) `DRY_RUN=0` with both directions on. Apps stay up during merge (no stop/flush).

From your Mac on the office LAN you can redeploy + dry-run with:

```bash
docs/setup/cron/deploy-merge-sync.sh
```

Turn off after **Cloudflare Tunnel** cutover (AS/WFH on `.ph` → local): `MERGE_SYNC_ENABLED=0` in `/mnt/ssd/secrets/cloud-sync.env`, or remove the cron line.

**Emergency only:** `sync-cloud-to-local-OVERWRITE.sh` with `CLOUD_SYNC_OVERWRITE_ENABLED=1` does a full dump/restore that **wipes local** — do not cron it.

### After a dump restore — re-grant `public` schema

A plain `pg_restore` can leave `anon` / `authenticated` / `service_role` **without** `USAGE` on `public`. Symptoms: Auth login works, but REST/UI shows `permission denied for schema public` or “Unable to load clients”. Fix (per stack DB container):

```bash
# Example: GP-Client / timekeep
docker exec supabase-client-db psql -U postgres -d postgres -c \
  "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
   GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;"
# Then clear Redis so stale error payloads are not served:
docker exec gp-redis redis-cli -a "$(grep '^REDIS_PASSWORD=' /mnt/ssd/redis/.env | cut -d= -f2-)" --no-auth-warning FLUSHDB
```

Saved copy: `/mnt/ssd/supabase/client/fixes/001_public_schema_grants.sql`

---

# Part E — Production on the server (done on gp-hris)

Office users hit the Ubuntu box directly. Vercel stays as emergency fallback only — do not dual-write.

## Layout

| Service | Path / port | Notes |
|---|---|---|
| Supabase HRIS | `:8000` | `/mnt/ssd/supabase/hris` |
| Supabase CSM | `:8100` | `/mnt/ssd/supabase/csm` |
| Supabase GP-Client | `:8200` | `/mnt/ssd/supabase/client` |
| GP-HRIS Next | `:3000` + nginx default | systemd `gp-hris.service` · `/mnt/ssd/apps/gp-hris` |
| GP-Client Next | `:3001` | systemd `gp-client.service` |
| CSM Next | `:3003` | systemd `csm-gp.service` |
| nginx | `:80` + `:443` | Host-based vhosts + TLS (see below) |
| Backups | cron 02:15 Manila | `/mnt/hdd/backups/supabase/*.dump` · `~/bin/backup-supabase.sh` |
| 201 scan blobs | HDD bind | `/mnt/hdd/storage/employee-documents` → HRIS Storage bucket |
| New-201 ETL | cron */30 7–19 Mon–Sat Manila | `~/bin/etl-directory-new-only.sh` ← GREENHRISMAIN |
| Shared Directory key | file | `/mnt/ssd/apps/shared.env` |
| TLS (self-signed) | `/etc/ssl/gp/` | Local CA; certbot installed for public LE later |
| Redis cache | `:6379` + REST `:8079` | `/mnt/ssd/redis` · systemd `gp-redis` · loopback only |

## Shared Redis (all three apps)

One Redis serves GP-HRIS / CSM / GP-Client. Apps already use `@upstash/redis` (HTTP), so a small REST proxy speaks that protocol against local Redis.

| Piece | Detail |
|---|---|
| Compose | `/mnt/ssd/redis/docker-compose.yml` |
| Secrets | `/mnt/ssd/redis/.env` (`REDIS_PASSWORD`, `SRH_TOKEN`) |
| App env copy | `/mnt/ssd/apps/shared-redis.env` |
| TCP | `127.0.0.1:6379` (`gp-redis`) |
| Upstash-compatible REST | `127.0.0.1:8079` (`gp-redis-http` / `hiett/serverless-redis-http`) |
| Memory | 512 MB · `allkeys-lru` · AOF on `/mnt/ssd/redis/data` |
| Key isolation | App prefixes: `gp:`, `csm:`, `gp-payroll:` |

Each app `.env.local` has:

```bash
UPSTASH_REDIS_REST_URL=http://127.0.0.1:8079
UPSTASH_REDIS_REST_TOKEN=<from /mnt/ssd/redis/.env SRH_TOKEN>
UPSTASH_REDIS_ENABLED=true
```

Supabase API is proxied **on the same HTTPS host** (`/auth`, `/rest`, `/realtime`, `/storage`, …) so browsers do not load `http://10.0.0.110:8000` (that mixed content made Chrome show **Not Secure** even when the cert was valid).

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hris.greenpasture.com   # or csm / timekeep host
```

```bash
sudo systemctl status gp-redis
cd /mnt/ssd/redis && sg docker -c 'docker compose --env-file .env ps'
# REST ping
TOKEN=$(grep SRH_TOKEN /mnt/ssd/redis/.env | cut -d= -f2-)
curl -sS -X POST http://127.0.0.1:8079/ \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '["PING"]'
```

## Office URLs

**One-time per PC** — run the office client installer (hosts + trust local CA):

| OS | How |
|---|---|
| Windows | Copy `docs/setup/office-client/` to the PC → right-click **`install-office-client.cmd`** → **Run as administrator** |
| macOS | `sudo bash docs/setup/office-client/install-office-client.sh` |

Same folder is also on the server at `/mnt/ssd/apps/office-client/` for USB/share handoff. See `docs/setup/office-client/README.md`.

Hosts line (if installing by hand):

```text
10.0.0.110  hris.greenpasture.com csm.greenpasture.com timekeep.greenpasture.com
```

Then open (HTTPS; HTTP redirects to HTTPS):

| App | Office LAN (`.com`) | AS / WFH (`.ph` via Cloudflare Tunnel) |
|---|---|---|
| GP-HRIS | `https://hris.greenpasture.com/` | `https://hris.greenpasture.ph/` |
| CSM-GP | `https://csm.greenpasture.com/` | `https://csm.greenpasture.ph/` |
| GP-Client (timekeeping) | `https://timekeep.greenpasture.com/` | `https://timekeep.greenpasture.ph/` |

`.ph` needs no hosts file / Local CA (Cloudflare TLS). Setup: [cloudflare-tunnel/README.md](./cloudflare-tunnel/README.md).

### Trust the local CA (required once per PC)

Browsers will warn until the office trusts the Green Pasture local CA. Prefer the installer above; manual file:

- `docs/setup/office-client/greenpasture-local-ca.crt`
- On the server: `/etc/ssl/gp/ca.crt`

Refresh self-signed leaf certs (2-year):

```bash
sudo gp-selfsign-certs
```

When these hostnames resolve **publicly** to this server, swap to Let’s Encrypt:

```bash
sudo gp-letsencrypt-when-public
```

(`certbot` + `python3-certbot-nginx` are installed; self-sign is intentional for LAN until public DNS exists.)

Path prefixes (`/csm`) were **not** used — Next.js needs `basePath` for that; Host names are cleaner.

## Admin login (local Auth)

- Email: `admin@greenpasture.local`
- Password: set at install — **change it** (`passwd` is OS; app password via Studio or app Settings)
- Temp password used at seed: ask operator / rotate immediately if this doc was shared

Supabase Studio / API keys: on the server

```bash
cd /mnt/ssd/supabase/hris && sh run.sh secrets   # or csm / client
```

## Useful commands

```bash
ssh admin-gp@10.0.0.110

# Apps
sudo systemctl status gp-hris csm-gp gp-client nginx gp-redis
sudo systemctl restart gp-hris

# Redis (shared cache — Upstash REST on :8079)
cd /mnt/ssd/redis && sg docker -c 'docker compose --env-file .env ps'

# Supabase stacks
cd /mnt/ssd/supabase/hris && sg docker -c 'docker compose ps'
cd /mnt/ssd/supabase/csm && COMPOSE_PROJECT_NAME=supabase-csm sg docker -c 'docker compose ps'
cd /mnt/ssd/supabase/client && COMPOSE_PROJECT_NAME=supabase-client sg docker -c 'docker compose ps'

# Manual backup
sg docker -c /home/admin-gp/bin/backup-supabase.sh
```

## Rebuild an app after code change

From your Mac, sync code → install → build → restart. **Do not** overwrite on-prem env files with cloud Vercel keys.

| App | Local folder (Mac) | Server path | systemd |
|---|---|---|---|
| GP-HRIS | `GP-HRIS/` | `/mnt/ssd/apps/gp-hris` | `gp-hris` |
| CSM-GP | `CSM-GP/` (or your clone path) | `/mnt/ssd/apps/csm-gp` | `csm-gp` |
| GP-Client | `GP-Client-Attendance-Payroll/` | `/mnt/ssd/apps/gp-client` | `gp-client` |

Example — **HRIS**:

```bash
cd "/Users/ecko/Desktop/Green Pasture/GP-HRIS"

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude .env.local --exclude .env.production.local --exclude .env*.local \
  -e "ssh -i ~/.ssh/id_ed25519" \
  "./" admin-gp@10.0.0.110:/mnt/ssd/apps/gp-hris/

ssh -i ~/.ssh/id_ed25519 admin-gp@10.0.0.110 \
  'cd /mnt/ssd/apps/gp-hris && npm ci && npm run build && sudo systemctl restart gp-hris'
```

Same pattern for CSM / Client — change the Mac path, remote path, and service name (`csm-gp` / `gp-client`).

**Keep on the server (do not rsync over):**

- `/mnt/ssd/apps/<app>/.env.local`
- `/mnt/ssd/apps/<app>/.env.production.local`  
  These must keep **local** Supabase URL/keys (`https://hris.greenpasture.com`, etc.), Redis, and Directory API key.

**Nginx Auth proxy:** Supabase GoTrue is only under `/auth/v1/`. App routes (`/auth/callback`, `/auth/update-password`, `/auth/sign-out`) must hit Next.js. If `location ^~ /auth/` is present, Chrome may show a Basic Auth popup. Fix:

```bash
sudo sed -i 's|location ^~ /auth/ {|location ^~ /auth/v1/ {|g' /etc/nginx/sites-available/gp-apps.conf
sudo nginx -t && sudo systemctl reload nginx
```

**DB migrations:** apply SQL to the matching stack under `/mnt/ssd/supabase/{hris,csm,client}` (Studio or `psql` in that stack’s `db` container), then rebuild the app if needed.

**Quick health:**

```bash
ssh admin-gp@10.0.0.110 'sudo systemctl status gp-hris csm-gp gp-client --no-pager'
```

## Notes from install

- Docker CE apt repo has no packages for Ubuntu 26 yet — used Ubuntu `docker.io` + `docker-compose-v2`.
- MicroK8s / Prometheus / keepalived / etcd snaps were **disabled** to free RAM.
- Some historical HRIS migrations failed (seed/data-dependent); Directory + cutoff + register tables are present. Revisit failed files in `/mnt/ssd/apps-src/migrations/hris-fail.log` if a feature errors.
- Directory API smoke: `GET /api/directory/organizations` with `x-directory-api-key` → 200.

---

# Cheat sheet

| What | Where |
|---|---|
| Server | `admin-gp@10.0.0.110` (`gp-hris`) |
| HRIS Supabase | `http://10.0.0.110:8000` |
| CSM Supabase | `http://10.0.0.110:8100` |
| Client Supabase | `http://10.0.0.110:8200` |
| GP-HRIS app | `https://hris.greenpasture.com/` |
| CSM app | `https://csm.greenpasture.com/` |
| GP-Client app | `https://timekeep.greenpasture.com/` |
| Local CA | `/etc/ssl/gp/ca.crt` · `sudo gp-selfsign-certs` |
| Redis | `127.0.0.1:8079` REST · `sudo systemctl status gp-redis` |
| Backups | `/mnt/hdd/backups/supabase/` · cron scripts in `~/bin/` + `docs/setup/cron/` |
| 201 scan blobs | `/mnt/hdd/storage/employee-documents` |
| Cron logs | `/mnt/hdd/logs/cron/` |
| New-201 ETL | `~/bin/etl-directory-new-only.sh` (GREENHRISMAIN → local Directory) |

---

# If you get stuck

| Problem | Fix |
|---|---|
| Laptop cannot open `http://10.0.0.110:8000` | Same LAN? UFW? Static IP still `10.0.0.110`? |
| App login fails | Keys in `/mnt/ssd/apps/<app>/.env.local`; Auth redirect URLs |
| App runs but empty/errors | Check migration fail logs under `/mnt/ssd/apps-src/migrations/` |
| CSM cannot see Directory | `gp-hris` service up; shared key in `shared.env` |
| After reboot DB “gone” | `docker` + compose projects; `mount -a`; `systemctl start gp-hris csm-gp gp-client` |
| Backup / ETL cron silent | Check `/mnt/hdd/logs/cron/`; `crontab -l` must include `CRON_TZ=Asia/Manila` |
| New 201s missing in People | `SQL_*` in `.env.production.local`; reachability of `10.0.0.167:1433`; run dry then `~/bin/etl-directory-new-only.sh` |

---

**Production path is live on the server.** Staff should bookmark the Host URLs above; keep Vercel only as emergency fallback during cutover.
