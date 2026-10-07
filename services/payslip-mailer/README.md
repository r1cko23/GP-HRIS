# Payslip mailer (office / local)

Small HTTP service GP-HRIS calls after payroll presses **Send**. One request = one employee email with the payslip PDF attached.

Organic cutoffs use the same Send button. Start here with house staff before Deployed.

## Office server (systemd user unit)

On `gp-hris` (`10.0.0.110`), the mailer runs as a user service and listens on `127.0.0.1:8790`.

```bash
# /mnt/ssd/apps/gp-hris/.env.local
PAYSLIP_MAILER_URL=http://127.0.0.1:8790/send
PAYSLIP_MAILER_KEY=<same as mailer .env>

# /mnt/ssd/apps/gp-hris/services/payslip-mailer/.env
MAILER_MODE=file   # or smtp when SMTP_* is set
PORT=8790
PAYSLIP_MAILER_KEY=<shared secret>
MAILER_OUT_DIR=/mnt/ssd/apps/gp-hris/services/payslip-mailer/outbox

mkdir -p ~/.config/systemd/user
cp gp-payslip-mailer.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now gp-payslip-mailer
curl -sS http://127.0.0.1:8790/health
```

File mode writes under `outbox/`. Switch `MAILER_MODE=smtp` and set `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`, then `systemctl --user restart gp-payslip-mailer`.

## Quick Organic test (no SMTP)

Writes each payslip PDF + a JSON sidecar under `services/payslip-mailer/outbox/`.

```bash
cd services/payslip-mailer
npm install
npm run start:file
```

In the GP-HRIS env (`.env.local` or the process that runs Next):

```bash
PAYSLIP_MAILER_URL=http://127.0.0.1:8790/send
# optional shared secret (set the same value on both sides)
PAYSLIP_MAILER_KEY=dev-local-key
```

Restart Next, open a **posted** Organic cutoff → Payslips and detail → **Send**.

Check:

```bash
ls -la services/payslip-mailer/outbox
```

## Real email (SMTP)

```bash
export MAILER_MODE=smtp
export SMTP_HOST=smtp.office365.com   # or your office relay
export SMTP_PORT=587
export SMTP_USER=payroll@greenpasture.ph
export SMTP_PASS=...
export SMTP_FROM="Green Pasture Payroll <payroll@greenpasture.ph>"
export PAYSLIP_MAILER_KEY=...         # required in production
npm run start:smtp
```

Point `PAYSLIP_MAILER_URL` at this host (still usually `http://127.0.0.1:8790/send` on the office server that also runs GP-HRIS).

## Contract

`POST /send` JSON — payslip (default):

| Field | Meaning |
|---|---|
| `to` | Directory email |
| `name` | Employee display name |
| `period_label` | Cutoff dates |
| `cutoff_period_id` | GP-HRIS cutoff id |
| `line_id` | Register line id |
| `filename` | `*.pdf` |
| `pdf_base64` | Payslip PDF |

`POST /send` JSON — staff password reset (`kind: "password_reset"`):

| Field | Meaning |
|---|---|
| `kind` | Must be `password_reset` |
| `to` | Staff email |
| `name` | Display name |
| `subject` | Email subject |
| `text` | Plain-text body with the recovery link |

No PDF for password reset. File mode writes a `.json` sidecar only.

Header when key is set: `x-payslip-mailer-key`.

`GET /health` → `{ ok, mode }`.

GP-HRIS forgot-password uses the same `PAYSLIP_MAILER_URL` / `PAYSLIP_MAILER_KEY`. It generates a Supabase recovery link (`admin.generateLink`) and sends it through this mailer instead of Supabase Auth email.
