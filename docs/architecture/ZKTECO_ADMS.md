# ZKTeco MB10-VL → Organic bundy (Green Pasture)

Live ADMS push into `time_clock_entries` for house staff assigned to **Green Pasture**.

## Device (MB10-VL SN `UDP3235201130`)

Ethernet (same LAN as Wi‑Fi gateway):

| Field | Value |
|---|---|
| IP | e.g. `10.0.0.201` |
| Mask | `255.255.255.0` |
| Gateway | router (e.g. `10.0.0.1`) |
| DNS | same or `8.8.8.8` |

Cloud Server Setting:

| Field | Local test (`next dev` on Mac) | Production (Vercel) |
|---|---|---|
| Server Mode | ADMS | ADMS |
| Enable Domain Name | OFF | **ON** |
| Server Address | Mac LAN IP e.g. `10.0.0.154` | HRIS hostname only (no `https://`) |
| Server Port | `3000` | `443` |
| HTTPS | **OFF** | **ON** |

Device calls:

- `GET /iclock/cdata?SN=…`
- `POST /iclock/cdata?SN=…&table=ATTLOG`
- `GET /iclock/getrequest?SN=…`

Poll cadence (server options): **Delay=10s / TransInterval=1m** while the ATTLOG dump is more than ~48h behind; once caught up, **Delay=60s / TransInterval=5m**. `Realtime=1` still pushes each live punch immediately.

## Names on “Waiting to map”

ATTLOG punches only include the PIN. Names live on the terminal and arrive via OPERLOG / USERINFO.

1. Keep ADMS pointed at your running HRIS (`next dev` or production).
2. On **Time → Biometric**, click **Sync names from device**.
3. Wait ~30–60s while the MB10 polls `/iclock/getrequest` and pushes users.
4. Click **Refresh** — **Name on terminal** fills in; search works by name or PIN.
5. Map each row to an enrolled Organic employee.


Fallback without an explicit map: if `public.employees.employee_id` (badge code) equals the device PIN **and** they are assigned to Green Pasture, the punch is accepted.

## Flow

```
MB10-VL → ADMS /iclock/cdata → applyAttlogPush → time_clock_entries
  → aggregate-from-office → cutoff → payroll
```

Clock rows use Green Pasture office lat/lng (so Entries shows the Ortigas address)
and `clock_*_device` = `Biometric` so the UI can badge them vs phone GPS bundy.

Mapped employees cannot clock via phone GPS (`employee_clock_in` / `employee_clock_out` refuse).
A biometric punch on a day that already has a phone bundy row replaces that IN (and the OUT follows the terminal).
