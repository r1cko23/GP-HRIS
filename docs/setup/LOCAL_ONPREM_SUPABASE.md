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

- **SSD** = live database (fast)
- **HDD** = backups only

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

# Part D — Backups (do this once HRIS works)

On the server, create `~/bin/backup-supabase.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%F)
OUT=/mnt/hdd/backups/supabase
mkdir -p "$OUT"
# Container name may differ — check with: docker ps
docker exec supabase-db pg_dump -U postgres -Fc postgres > "$OUT/hris-$STAMP.dump"
find "$OUT" -type f -mtime +14 -delete
```

```bash
chmod +x ~/bin/backup-supabase.sh
crontab -e
```

Add:

```cron
15 2 * * * /usr/bin/sg docker -c /home/admin-gp/bin/backup-supabase.sh >> /home/admin-gp/backup-supabase.log 2>&1
```

(Already installed on `gp-hris` — dumps **hris**, **csm**, and **client** nightly.)

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
| nginx | `:80` | Host-based vhosts (see below) |
| Backups | cron 02:15 | `/mnt/hdd/backups/supabase/*.dump` |
| Shared Directory key | file | `/mnt/ssd/apps/shared.env` |

## Office URLs

Add to each PC’s hosts file (or office DNS):

```text
10.0.0.110  hris.gp.local csm.gp.local time.gp.local
```

Then open:

| App | URL |
|---|---|
| HRIS | `http://hris.gp.local/` or `http://10.0.0.110/` |
| CSM | `http://csm.gp.local/` or `http://10.0.0.110:3003/` |
| Timekeeping | `http://time.gp.local/` or `http://10.0.0.110:3001/` |

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
sudo systemctl status gp-hris csm-gp gp-client nginx
sudo systemctl restart gp-hris

# Supabase stacks
cd /mnt/ssd/supabase/hris && sg docker -c 'docker compose ps'
cd /mnt/ssd/supabase/csm && COMPOSE_PROJECT_NAME=supabase-csm sg docker -c 'docker compose ps'
cd /mnt/ssd/supabase/client && COMPOSE_PROJECT_NAME=supabase-client sg docker -c 'docker compose ps'

# Manual backup
sg docker -c /home/admin-gp/bin/backup-supabase.sh
```

## Rebuild an app after code change

From your Mac (example HRIS):

```bash
rsync -az --delete --exclude node_modules --exclude .next --exclude .git \
  -e "ssh -i ~/.ssh/id_ed25519" \
  "./" admin-gp@10.0.0.110:/mnt/ssd/apps/gp-hris/
ssh admin-gp@10.0.0.110 'cd /mnt/ssd/apps/gp-hris && npm ci && npm run build && sudo systemctl restart gp-hris'
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
| GP-HRIS app | `http://10.0.0.110/` or `http://hris.gp.local/` |
| CSM app | `http://csm.gp.local/` or `:3003` |
| GP-Client app | `http://time.gp.local/` or `:3001` |
| Backups | `/mnt/hdd/backups/supabase/` |

---

# If you get stuck

| Problem | Fix |
|---|---|
| Laptop cannot open `http://10.0.0.110:8000` | Same LAN? UFW? Static IP still `10.0.0.110`? |
| App login fails | Keys in `/mnt/ssd/apps/<app>/.env.local`; Auth redirect URLs |
| App runs but empty/errors | Check migration fail logs under `/mnt/ssd/apps-src/migrations/` |
| CSM cannot see Directory | `gp-hris` service up; shared key in `shared.env` |
| After reboot DB “gone” | `docker` + compose projects; `mount -a`; `systemctl start gp-hris csm-gp gp-client` |

---

**Production path is live on the server.** Staff should bookmark the Host URLs above; keep Vercel only as emergency fallback during cutover.
