# Executive Report — Payroll Parity Findings  
**GREENHRISMAIN vs GP-HRIS (Deployed)**

| | |
|---|---|
| **To** | Chief Executive Officer |
| **From** | GP-HRIS / Payroll Systems |
| **Date** | 6 October 2026 |
| **Subject** | Nabati Food Philippines Inc. — Sep 1–15, 2026 payroll statutory review |
| **Classification** | Internal — decision support |
| **Recommendation** | **Adopt GP-HRIS as the correct payroll engine for this cohort; treat GREENHRISMAIN SSS as understated** |

---

## 1. Purpose

We compared the legacy GREENHRISMAIN payroll register to the new GP-HRIS payroll register for one Deployed client cutoff, to answer:

1. Are we calculating and recording the right values?
2. Where the two systems disagree, which one should we keep?

**Sample:** Nabati Food Philippines Inc. (legacy client 130), cutoff **1–15 September 2026**, **98 employees**, hours from validated GP-Client sites (Baesa, Batangas, Bicol, Cavite, Laguna, Las Piñas, Lucena, Taytay).

---

## 2. Executive decision

| Decision | Detail |
|---|---|
| **Keep** | **GP-HRIS** statutory SSS for this pattern (period compensation including overtime) |
| **Do not treat as correct** | GREENHRISMAIN SSS for this cutoff |
| **Aligned / no change needed** | PhilHealth, Pag-IBIG, and withholding tax for this cohort |

GP-HRIS matches the official SSS contribution table when applied to **actual period gross pay**. GREENHRISMAIN applies the same table to a **narrower base** that systematically excludes overtime, even though its own setting says the SSS basis is “gross.”

---

## 3. Headline numbers

| Metric | GP-HRIS | GREENHRISMAIN | Difference (GP − MAIN) |
|---|---:|---:|---:|
| Employees compared | 98 | 98 | — |
| Gross pay (total) | ₱1,011,894.89 | ₱1,007,492.18 | +₱4,402.71 |
| Exact gross match (people) | **87 / 98** | — | — |
| SSS employee share (total) | **₱50,650** | **₱43,975** | **+₱6,675** |
| PhilHealth EE | ₱24,500 | ₱24,500 | ₱0 |
| Pag-IBIG EE | ₱19,600 | ₱19,600 | ₱0 |
| Withholding tax | ₱0 | ₱0 | ₱0 |

**SSS:** GP-HRIS is higher for **96 of 98** people; equal for 2; MAIN is never higher.  
On the **85 people with identical gross**, MAIN still understates SSS by a total of **₱5,950** — proving the gap is the **SSS base**, not hours.

---

## 4. Findings

### 4.1 What is working

- **Cash earnings (gross):** Strong agreement — exact match for 87 of 98 employees.
- **PhilHealth and Pag-IBIG:** Perfect agreement across all 98.
- **Withholding tax:** Both systems recorded ₱0 for this cohort (earnings remain under the TRAIN withholding threshold for these amounts).

### 4.2 Material defect in GREENHRISMAIN — SSS basis

GREENHRISMAIN records `sssbasis = gross` for all 98 employees, but computes SSS from `grossamttaxable`, which is **not** period gross:

| Pattern in MAIN | Count (of 98) |
|---|---:|
| Taxable base equals **basic pay only** (OT excluded) | 60 |
| Taxable base between basic and gross (partial) | 35 |
| Taxable base equals full gross | 3 |
| Flag says “gross” but taxable &lt; actual gross | **95** |

The amounts MAIN excludes are stored as **overtime / adjustment** (`TotalOT`), not as non-taxable allowances. Site allowance columns for this cutoff are empty for all 98 people.

**Independent check against the 2025–2026 SSS table:**

| Input used for table lookup | Matches recorded SSS |
|---|---|
| GP period gross → GP SSS | **98 / 98** |
| MAIN `grossamttaxable` → MAIN SSS | 98 / 98 (table OK; **input wrong**) |
| MAIN full gross → MAIN SSS | only **4 / 98** |

Conclusion: MAIN’s bracket math is fine; its **compensation input understates SSS** relative to its own “gross” setting and to period pay including overtime.

### 4.3 Illustrative case — Añonuevo

| | Amount |
|---|---:|
| Basic pay | ₱9,035.00 |
| Overtime / add-on | ₱725.01 |
| **Period gross (paid)** | **₱9,760.01** |
| MAIN SSS base (`grossamttaxable`) | ₱9,035.00 |
| MAIN SSS EE recorded | ₱450 |
| SSS table on full gross (GP) | **₱500** |

The ₱725 is overtime in MAIN, not a BIR de minimis allowance. Overtime is compensation for SSS purposes. Labeling it “allowance” in GP earnings breakdown is a display mapping issue; it does not make the amount non-taxable or SSS-exempt.

### 4.4 Secondary issue — 11 gross mismatches

Eleven employees differ in gross (GP total higher by ₱4,402.71). That is a **hours / premium composition** follow-up, separate from the SSS-basis defect. It does not change the SSS conclusion: even where gross matches exactly, MAIN SSS is still low.

---

## 5. Compliance reading (summary)

| Regime | Assessment for this cohort |
|---|---|
| **SSS (RA 11199)** | Compensation for MSC includes overtime. MAIN’s practice of excluding OT while flagged as “gross” **understates** employee (and, by extension, employer) SSS relative to period earnings. **GP-HRIS is the correct position.** |
| **PhilHealth** | Both systems aligned. |
| **Pag-IBIG** | Both systems aligned. |
| **BIR withholding tax** | Both ₱0; no immediate WTAX gap on this sample. SSS and BIR bases are not the same; “not withheld for tax” does not authorize excluding OT from SSS. |

*This report supports an internal systems decision. It is not a substitute for a formal external audit or a remittance filing review (SSS R-3 / equivalent).*

---

## 6. Financial / risk implication

| Item | Estimate (this cutoff only) |
|---|---|
| SSS EE understatement in MAIN vs GP | **₱6,675** |
| Approximate ER understatement (order of magnitude, ~2× EE under current 15% split) | **~₱13,000** |
| Combined order of magnitude if this pattern repeats monthly across Deployed sites | **Material** — warrants policy confirmation and cutover planning |

Risk if we continue to treat MAIN as correct: under-remittance of SSS relative to actual compensation paid, and inconsistent employee MSC credits.

Risk if we keep GP-HRIS: register SSS will be **higher** than historical MAIN debit memos; finance and client billing should be briefed before go-live on each Deployed client.

---

## 7. Recommendations

1. **Approve GP-HRIS as the system of record for SSS** on Deployed cutoffs using period-gross / compensation including overtime (current Nabati pattern).
2. **Do not “fix” GP downward to match MAIN** on SSS for this defect.
3. **Brief Finance / Payroll Ops** that MAIN debit memos will show lower SSS than GP for OT-heavy first kinsenas; variance is explained and intentional.
4. **Queue follow-ups (ops, not blockers for the SSS decision):**
   - Resolve the 11 gross mismatches (hours/premiums).
   - Align GP earnings labels so OT is not shown as “allowance.”
   - Spot-check a second Deployed client and a second kinsena before broad cutover.
   - When ready, reconcile remittance files to GP registers—not to MAIN SSS for this pattern.

---

## 8. Decision requested

Please confirm:

> **GP-HRIS payroll values (including SSS on period gross with overtime) are approved as correct for Deployed Nabati-style processing; GREENHRISMAIN SSS understatement is acknowledged and will not be used as the target for GP parity.**

| | Name | Date |
|---|---|---|
| Prepared by | ________________________ | ________ |
| Reviewed (Payroll / Finance) | ________________________ | ________ |
| Approved (CEO) | ________________________ | ________ |

---

## Appendix A — Evidence pack (internal)

| Artifact | Location |
|---|---|
| Cohort summary | `tmp/sample-match/nabati-2026-09-01_2026-09-15-summary.json` |
| MAIN dump (parity grain) | `tmp/sample-match/nabati-2026-09-01_2026-09-15-main.json` |
| MAIN SSS basis fields | `tmp/sample-match/nabati-sss-basis.json` |
| Compare script | `scripts/nabati-sep-gp-client-compare.ts` |
| GP register run | `898f5b44-bee4-4fa4-8bc2-12d3a2abcac4` |
| Cutoff | `c2513f46-e84f-4816-b872-89dc6ec1c7d3` |

## Appendix B — Scope limits

- One client, one cutoff (first half of September 2026).
- Organic house payroll not covered in this memo.
- Remittance filings and bank files not re-audited in this pass.
- Employer SSS / ECC line items inferred from schedule; EE line items were matched person-by-person.
