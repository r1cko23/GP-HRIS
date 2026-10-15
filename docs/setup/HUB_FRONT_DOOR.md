# Hub front door (`hub.greenpasture.*`)

Workplace bookmark for CSM + Timekeep. Does **not** merge databases. Flags stay off until pilot.

## DNS / Cloudflare (`.ph`)

1. Tunnel route: `hub.greenpasture.ph` → `http://127.0.0.1:80` with `httpHostHeader: hub.greenpasture.ph` (see [cloudflare-tunnel/config.yml.example](./cloudflare-tunnel/config.yml.example)).
2. Cloudflare DNS CNAME `hub` → tunnel (or Tunnel → Route traffic).
3. Re-run Access + cache bypass: `bash cloudflare-tunnel/apply-access-and-cache.sh` (includes `hub.greenpasture.ph`).

## SSH on `admin-gp@10.0.0.110`

1. Install/update nginx `.ph` conf from `cloudflare-tunnel/gp-apps-ph.conf` (includes `server_name hub.greenpasture.ph` → CSM Next `:3003` + CSM Kong `:8100`).
2. Mirror the same `server_name` on office `.com` vhost (`gp-apps.conf`) so `hub.greenpasture.com` works on LAN.
3. `sudo nginx -t && sudo systemctl reload nginx`
4. Update `/etc/cloudflared/config.yml` from the example; `sudo systemctl restart cloudflared`

## Office clients (`.com`)

Re-run `office-client/install-office-client.sh` (adds `hub.greenpasture.com` to hosts).

## App env (only when piloting)

Same secret on **both** apps:

```
HUB_SHELL=true
NEXT_PUBLIC_HUB_SHELL=true
HUB_HANDOFF=true
HUB_HANDOFF_SECRET=<long shared secret>
# Later:
HUB_GOOGLE_AUTH=true
NEXT_PUBLIC_HUB_GOOGLE_AUTH=true
```

Google (Cloud Console → APIs & Services → Credentials → OAuth client `520497…`):

**Authorized JavaScript origins** (origins only, no path):

- `https://hub.greenpasture.ph`
- `https://hub.greenpasture.com`
- `https://csm.greenpasture.ph` / `.com`
- `https://timekeep.greenpasture.ph` / `.com`
- `https://hris.greenpasture.ph` / `.com` (if HRIS uses the same client)
- `http://localhost:3000` / `3001` / `3003` (local)

**Authorized redirect URIs** (GoTrue callback — path required):

- `https://hub.greenpasture.ph/auth/v1/callback`
- `https://hub.greenpasture.com/auth/v1/callback`
- `https://csm.greenpasture.ph/auth/v1/callback` / `.com`
- `https://timekeep.greenpasture.ph/auth/v1/callback` / `.com`
- `https://hris.greenpasture.ph/auth/v1/callback` / `.com`
- `http://localhost:3000/auth/v1/callback` (and 3001 / 3003 if you hit Auth via those ports)

On-prem GoTrue already has `https://hub.greenpasture.*/**` in `ADDITIONAL_REDIRECT_URLS` (app `/auth/callback` after Google). CSM Auth still returns to `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://csm.greenpasture.com/auth/v1/callback` unless you change that env to the hub URI and recreate the auth container.

## Rollback

Unset `HUB_*`; remove or disable `hub` tunnel hostname. `csm.*` / `timekeep.*` keep working.
