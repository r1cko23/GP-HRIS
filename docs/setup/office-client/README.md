# Office PC setup (hosts + local CA)

One-time install on each staff Mac or Windows PC so the on-prem apps open without DNS/certificate warnings.

Keep these three files together:

- `greenpasture-local-ca.crt`
- `install-office-client.cmd` + `install-office-client.ps1` (Windows)
- `install-office-client.sh` (macOS)

## Windows

1. Copy the whole `office-client` folder to the PC (USB / shared drive / `\\gp-hris\...`).
2. Right-click **`install-office-client.cmd`** → **Run as administrator**.
3. Close all browsers, then open `https://hris.greenpasture.com`.

## macOS

```bash
cd /path/to/office-client
sudo bash install-office-client.sh
```

Quit Chrome/Safari fully (Cmd+Q), then reopen the URLs.

## What it does

| Step | Result |
|---|---|
| Hosts | `10.0.0.110` → `hris` / `csm` / `timekeep.greenpasture.com` |
| Certificate | Trust **Green Pasture Local CA** as a root CA |

Optional override:

```bash
# Mac
sudo GP_SERVER_IP=10.0.0.110 bash install-office-client.sh

# Windows (PowerShell as Admin)
.\install-office-client.ps1 -ServerIp 10.0.0.110
```

If the office later uses real DNS for these names, you can remove the hosts line; keep the CA until you switch to Let’s Encrypt.
