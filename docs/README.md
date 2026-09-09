# GP-HRIS Documentation

## Quick Links

| Document                                       | Description                 |
| ---------------------------------------------- | --------------------------- |
| [PRD](./PRD.md) | Product: Organic + Deployed, three-app process, where we are |
| [Nabati Batangas CSM tagging brief (PDF)](./nabati-batangas-csm-tagging-brief.pdf) | Stakeholder pack: CSM had the site right; the 201 did not |
| [Architecture essentials](./architecture/architecture-essentials.md) | Ownership, seams, shipped vs not |
| [Architecture](./architecture/Architecture.md) | Topology, schema, APIs, flows |
| [Client SOA / debit memo](./architecture/CLIENT_BILLING_SOA.md) | Per-client billing file packs (ALDEX / GENERIC / PLK / debit memo) |
| [Three-app process](./architecture/THREE_APP_PROCESS.md) | How Deployed cutoff runs across CSM, GP-Client, HRIS |
| [Deployed worker walkthrough](./architecture/DEPLOYED_WORKER_WORKFLOW.md) | Presentation: who does what, AM Verified gate, slides |
| [Deployed integration](./architecture/DEPLOYED_INTEGRATION.md) | Directory UUIDs, ingest, hour mapping |
| [DIRECTORY INTEGRATION](./architecture/DIRECTORY_INTEGRATION.md) | GP-Directory IDs and webhooks |
| [QUICKSTART](./setup/QUICKSTART.md)            | Get started in 10 minutes   |
| [SETUP](./setup/SETUP.md)                      | Full setup guide            |
| [DEPLOYMENT](./deployment/DEPLOYMENT_GUIDE.md) | Deploy to production        |
| [PRIVACY COMPLIANCE](./privacy/README.md)      | Data Privacy Act compliance |

---

## Documentation Structure

```
docs/
├── PRD.md                         # Product requirements (three-app process)
├── adr/
│   └── README.md                  # Living ADRs 0001–0012
├── architecture/
│   ├── architecture-essentials.md # One-screen map
│   ├── Architecture.md            # Full topology / APIs / flows
│   ├── THREE_APP_PROCESS.md       # Deployed cutoff across three apps
│   ├── DEPLOYED_INTEGRATION.md    # UUID columns + ingest
│   ├── DIRECTORY_INTEGRATION.md
│   └── MODULAR_ARCHITECTURE.md    # Modular monolithic guide
├── deployment/
│   ├── DEPLOYMENT_GUIDE.md        # Full deployment guide
│   └── VERCEL_DEPLOYMENT_FIX.md   # Vercel-specific fixes
├── guides/
│   ├── IMPLEMENTATION_SUMMARY.md  # Feature implementation notes
│   ├── LOCATION_LOCKING_SETUP.md  # GPS location setup
│   ├── PAYROLL_BEST_PRACTICES.md  # PH payroll calculations
│   └── RLS_SECURITY_GUIDE.md      # Supabase RLS policies
├── privacy/
│   ├── DATA_PRIVACY_MANUAL.md     # Data Privacy Manual (for NPCRS)
│   ├── PRIVACY_NOTICE.md          # Privacy Notice
│   ├── NPCRS_SUBMISSION_GUIDE.md  # Submission guide
│   └── README.md                   # Privacy docs index
├── setup/
│   ├── QUICKSTART.md              # Quick start guide
│   ├── SETUP.md                   # Full setup instructions
│   └── SUPABASE_MCP_SETUP.md      # MCP configuration
├── status/
│   └── PROJECT_STATUS.md          # Current project status
├── ROLE_ACCESS_MATRIX.md          # Role-based access control
└── ROLE_ACCESS_QUICK_REFERENCE.md # Quick access reference
```

---

## Key Topics

### 🚀 Getting Started

- [Quickstart Guide](./setup/QUICKSTART.md) - 10 minute setup
- [Full Setup Guide](./setup/SETUP.md) - Complete instructions
- [Supabase MCP Setup](./setup/SUPABASE_MCP_SETUP.md) - AI integration

### 📦 Architecture

- [Architecture essentials](./architecture/architecture-essentials.md) — three-app seams and ownership
- [Architecture](./architecture/Architecture.md) — system map, schema, Organic vs Deployed flows
- [Modular Architecture](./architecture/MODULAR_ARCHITECTURE.md) - Code organization

### 💰 Payroll

- [Payroll Best Practices](./guides/PAYROLL_BEST_PRACTICES.md) - PH labor law calculations

### 🔒 Security

- [RLS Security Guide](./guides/RLS_SECURITY_GUIDE.md) - Row-level security
- [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) - Access control documentation

### 🔐 Privacy & Compliance

- [Privacy Compliance](./privacy/README.md) - Data Privacy Act (RA 10173) compliance
- [Data Privacy Manual](./privacy/DATA_PRIVACY_MANUAL.md) - Complete manual for NPCRS submission

### 🚢 Deployment

- [Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md) - Production deployment
- [Vercel Fixes](./deployment/VERCEL_DEPLOYMENT_FIX.md) - Common issues