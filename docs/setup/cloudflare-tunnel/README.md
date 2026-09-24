# Cloudflare Tunnel — `.ph` remote / `.com` office → one local DB

**Goal:** AS and WFH open `*.greenpasture.ph`; office LAN keeps `*.greenpasture.com`. Both hit the **same** Next apps + Kong + Postgres on `gp-hris`. No second cloud database for daily work.

| Who | URL | Path |
|---|---|---|
| Office LAN | `https://hris\|csm\|timekeep.greenpasture.com` | nginx on `10.0.0.110` (unchanged) |
| AS / WFH | `https://hris\|csm\|timekeep.greenpasture.ph` | Cloudflare Tunnel → same nginx |
| Vercel (old) | Freeze after cutover | Do not dual-write; disable merge sync |

Cost: Cloudflare Tunnel + Access Free (≤50 seats). Do **not** publish Postgres `5432`.

Kong is already same-origin on each app host (`/auth`, `/rest`, …). Tunnel only needs the three app hostnames; no separate `*-api` hosts.

---

## One DB + one Redis (`.com` and `.ph`)

After cutover, both hostnames hit the **same** Next processes on `gp-hris`:

| Layer | Shared? | Notes |
|---|---|---|
| Postgres (local Supabase) | Yes | Writes on either hostname are visible to the other on the next DB read |
| Redis | Yes — **local** on `127.0.0.1:8079` | Env is `UPSTASH_REDIS_REST_URL=http://127.0.0.1:8079` — the Upstash **client library** talks to the office REST proxy, **not** cloud Upstash |
| Browser `sessionStorage` | No (per origin) | `.com` and `.ph` each have their own session cache; epoch probe / refresh / hard reload picks up the other side |

**You do not configure a second Redis for `.ph`.** If `.ph` still uses cloud Upstash, that hostname is still the **Vercel** app — freeze Vercel and use Tunnel `.ph` only.

### Cloudflare CDN (must bypass)

Orange-cloud DNS can cache responses. For the three app hostnames, add a **Cache Rule**: hostname is `hris` / `csm` / `timekeep.greenpasture.ph` → **Bypass cache**. Otherwise UI can look stale even though Postgres updated.

### Post-cutover freshness test

1. Office: open `https://csm.greenpasture.com` — make a visible change (e.g. draft note / approve).
2. Phone off Wi‑Fi: open `https://csm.greenpasture.ph` — hard refresh (or wait for focus/epoch). Same change appears.
3. Reverse: change on `.ph`, confirm on `.com`.
4. On `gp-hris`: `docker exec gp-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning PING` — both sides use this Redis when Tunnel is live.
5. Confirm `.ph` HTML is not CF-cached: response header `cf-cache-status: DYNAMIC` or `BYPASS`.

UI lag of seconds is normal (session cache + epoch). Multi-minute lag means Cloudflare cache or still on Vercel cloud.

---

## Prerequisites

- Cloudflare account that can manage DNS for `greenpasture.ph`
- SSH to `gp-hris` as `admin-gp` with sudo
- This folder deployed to the server (e.g. `/mnt/ssd/apps/gp-hris/docs/setup/cloudflare-tunnel/`)

---

## Step 1 — Cloudflare: create tunnel (dashboard or CLI)

On your Mac (or on `gp-hris` if you prefer):

1. Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared → name `gp-hris-onprem`.
2. Copy the install token / run the install command Cloudflare shows **on `gp-hris`** (needs sudo).
3. Or use a config file (preferred for three hostnames): after `cloudflared tunnel create gp-hris-onprem`, copy credentials JSON to `/mnt/ssd/secrets/cloudflared/` and use [config.yml.example](./config.yml.example).

### DNS (Cloudflare zone for `greenpasture.ph`)

CNAME (proxied / orange cloud) each to the tunnel:

| Name | Target |
|---|---|
| `hris` | `<tunnel-id>.cfargotunnel.com` |
| `csm` | `<tunnel-id>.cfargotunnel.com` |
| `timekeep` | `<tunnel-id>.cfargotunnel.com` |

(Cloudflare UI “Route traffic” on the tunnel can create these for you.)

---

## Step 2 — nginx: accept `.ph` Host headers (HTTP to tunnel)

Cloudflare terminates TLS. `cloudflared` talks **HTTP** to nginx on loopback with `Host: *.greenpasture.ph`.

On `gp-hris`:

```bash
cd /path/to/docs/setup/cloudflare-tunnel
sudo bash install-nginx-ph.sh
sudo nginx -t && sudo systemctl reload nginx
```

This adds `server_name` for `hris|csm|timekeep.greenpasture.ph` on port 80 (proxy only; no redirect to `.com`).

---

## Step 3 — cloudflared config + systemd

```bash
sudo bash install-cloudflared.sh   # installs binary if missing; writes config; enables service
sudo systemctl status cloudflared
```

Edit `/etc/cloudflared/config.yml` so `tunnel:` and `credentials-file:` match your tunnel UUID. See [config.yml.example](./config.yml.example).

Smoke test from your phone (off office Wi‑Fi):

```text
https://csm.greenpasture.ph
```

You should reach the on-prem CSM login (Access gate may appear after Step 4).

---

## Step 4 — Cloudflare Access (free seats)

Zero Trust → Access → Applications → Add self-hosted for each:

- `hris.greenpasture.ph`
- `csm.greenpasture.ph`
- `timekeep.greenpasture.ph`

Policy: Allow emails ending in `@greenpasture.ph` (Google) or one-time PIN.  
Stay under **50** free seats. Remove leavers in Team → Users.

---

## Step 5 — Supabase Auth allow `.ph` redirects

On each local stack (Studio or `auth` env), add redirect URLs for:

- `https://hris.greenpasture.ph/**` (and csm / timekeep)
- Keep existing `https://*.greenpasture.com/**`

GoTrue `GOTRUE_SITE_URL` / `API_EXTERNAL_URL` can stay the `.com` canonical URL; additional redirect URLs must include `.ph`.

If Auth lives in Docker env under `/mnt/ssd/supabase/{hris,csm,client}`, add e.g.:

```bash
GOTRUE_URI_ALLOW_LIST=https://hris.greenpasture.com/*,https://hris.greenpasture.ph/*,...
```

Then recreate the auth container for that stack.

---

## Step 6 — App code (same-origin `.ph`)

**GP-HRIS** (this repo): `lib/supabase/public-url.ts` + client/middleware use the browser/request host so `.ph` calls Kong on `.ph`. Deploy/rebuild on the server after pull.

**CSM-GP** and **GP-Client:** apply the same pattern (copy `public-url.ts` + client/middleware wiring) or temporarily set `NEXT_PUBLIC_SUPABASE_URL` to the `.ph` host and force remote users only onto `.ph` for that app until patched.

Office can keep `.com` UI; after the GP-HRIS fix, office browsers call Kong on `.com`.

---

## Step 7 — Cut over and stop dual-write

1. Pilot: 1 AS + 1 WFH on `.ph`; confirm data in **local** Studio/DB.
2. Tell all AS to use `.ph` bookmarks (not Vercel cloud).
3. Freeze Vercel production deploys for the three apps (emergency only).
4. On `gp-hris`: set `MERGE_SYNC_ENABLED=0` in `/mnt/ssd/secrets/cloud-sync.env` (or remove the merge cron line).

---

## Onboarding cheat sheet

**AS / WFH:** Access email → open `https://csm.greenpasture.ph` (etc.). No hosts file, no Local CA.

**Office LAN:** keep [office-client](../office-client/README.md) for `.com`.

**Offboard:** remove Cloudflare Access user / Google account.

---

## Rollback

```bash
sudo systemctl stop cloudflared
# optional: disable DNS CNAMEs or Access apps in Cloudflare
```

Office `.com` keeps working. Re-enable merge sync only if you must write to cloud again.

---

## Ops notes

- Office ISP/power down ⇒ `.ph` users offline.
- `cloudflared` and nginx must start on boot (`systemctl is-enabled cloudflared nginx`).
- Never add Postgres ports to the tunnel ingress.
