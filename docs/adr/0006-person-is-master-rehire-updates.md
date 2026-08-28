# Person is master; rehire updates (option A)

GREENHRISMAIN issued a new `Employee_id` per hire episode. Directory keeps **one master 201 per person**. Rehire **updates** that row (status, client, position, rates, latest hire date) and appends movement history — it does not insert a second person. Concurrent multi-client engagements are out of scope (rejected option B). Live `employee_code` is `YYYYMM-#####` from first hire month, issued once and never regenerated on rehire. GREENHRISMAIN IDs and prior day-level codes stay in `employee_code_aliases`. Historical engagement rows remain for audit.

## Considered options

- **A (chosen):** One master row; change `client_id` on reassignment/rehire.
- **B:** Multiple concurrent engagement rows per person — only if true dual-client employment is required later.
