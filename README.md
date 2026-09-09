# Green Pasture HRIS

Next.js HRIS for Green Pasture People Management Inc.: Directory (Organic + Deployed), Organic clock, and the Organic payroll register. Sibling apps — **CSM-GP** (Deployed headcount) and **GP-Client-Attendance-Payroll** (per-client DTR) — are meant to share Directory IDs and a cutoff-hours document.

## Where to start

| Doc | What it is |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product: one process across the three apps; shipped vs missing |
| [docs/architecture/architecture-essentials.md](docs/architecture/architecture-essentials.md) | One-screen architecture |
| [docs/architecture/Architecture.md](docs/architecture/Architecture.md) | Topology, schema, APIs, flows |
| [CONTEXT.md](CONTEXT.md) | Glossary |
| [CLAUDE.md](CLAUDE.md) | Agent brief |
| [docs/README.md](docs/README.md) | Full documentation index |

## Documentation

Guides, ADRs, and setup live under `docs/`.

## Getting Started

1. `cp .env.example .env.local` (or ensure the Supabase env vars listed in `docs/setup/SETUP.md` are present)
2. `npm install`
3. `npm run dev`

For deployment steps and environment requirements, see `docs/deployment/DEPLOYMENT_GUIDE.md`.