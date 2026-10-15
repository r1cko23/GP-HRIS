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

Google also needs GoTrue `GOTRUE_EXTERNAL_GOOGLE_*` on CSM + Client stacks and OAuth redirect URIs for hub/csm/timekeep on `.ph` and `.com`.

## Rollback

Unset `HUB_*`; remove or disable `hub` tunnel hostname. `csm.*` / `timekeep.*` keep working.
