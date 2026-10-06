# Payslip mailer (office / local)

Small HTTP service GP-HRIS calls after payroll presses **Send**. One request = one employee email with the payslip PDF attached.

Organic cutoffs use the same Send button. Start here with house staff before Deployed.

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

`POST /send` JSON:

| Field | Meaning |
|---|---|
| `to` | Directory email |
| `name` | Employee display name |
| `period_label` | Cutoff dates |
| `cutoff_period_id` | GP-HRIS cutoff id |
| `line_id` | Register line id |
| `filename` | `*.pdf` |
| `pdf_base64` | Payslip PDF |

Header when key is set: `x-payslip-mailer-key`.

`GET /health` → `{ ok, mode }`.
