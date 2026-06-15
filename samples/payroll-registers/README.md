# Payroll register sample PDFs

Drop client payroll register PDFs here to train and verify the parser (`lib/payroll-summary/`).

## Quick start

1. Copy PDF files into this folder (any subfolder is fine).
2. Run a parse report on everything:

   ```bash
   npm run parse:payroll-samples
   ```

3. After checking output, add expected totals to `manifest.json` (see below).
4. Run verification:

   ```bash
   npm run verify:payroll-samples
   ```

## File naming (required for upload)

**Payroll Audit upload only accepts files whose name starts with:**

- `PAYROLL SUMMARY_…`
- `Payroll Summary_…`
- `Payrollsummary_…`

Examples from your sample folders:

```text
PAYROLL SUMMARY_CHICHA HUT.pdf
Payroll Summary_VIVENTIS.pdf
Payrollsummary_LAGUNA.pdf
```

ATM payslips, cash reports, and payroll reports in the same folder are **ignored** by the training script (use `--all` to parse them for debugging).

## Manifest (`manifest.json`)

Each PDF can have an entry with **expected parse results**. The verify script compares parser output to these values.

```json
{
  "Payroll summary_CONVERGE_1-15.pdf": {
    "client": "Converge",
    "layout": "external-28",
    "periodStart": "2026-05-01",
    "periodEnd": "2026-05-15",
    "employeeCount": 167,
    "grossAmountTotal": 2486064.9,
    "netAmountTotal": 2272899,
    "spotCheckEmployee": "AVANCEÑA"
  }
}
```

Generate a starter entry from a parsed file:

```bash
npm run parse:payroll-samples -- --manifest-stub "YourFile.pdf"
```

## Privacy

PDFs in this folder are **gitignored** by default (they often contain employee payroll data). Only `manifest.json` and this README are meant to be committed. Keep PDFs local or in secure storage.

## Layout notes

| Layout tag | Description |
|------------|-------------|
| `external-28` | Converge-style wide earnings block (28 columns) |
| `external-24` | Chicha Hut 24-column register |
| `external-21` | Chicha Hut 21-column register |
| `gp-hris-34` | GP-HRIS payroll register export |

When adding a new client format, upload 2+ cutoffs here and run `npm run parse:payroll-samples` — we use the output to extend column maps in `lib/payroll-summary/register-columns.ts`.
