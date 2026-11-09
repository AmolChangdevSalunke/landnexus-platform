# LandNexus - Unified Digital Land Acquisition & Management Platform

A modular monolith for the land acquisition life cycle: government projects and consultant proposals, land records and documents,
acquisition cases (survey, notices, objections, award, possession), valuation and compensation with a configurable rule engine,
simulated payments and R&R, PostGIS boundaries and conflict reports, dashboards, MIS reports and SLA monitoring.

| Part | Technology |
|---|---|
| `landnexus-backend` | Java 21, Spring Boot 4, PostgreSQL 18 + PostGIS, Flyway, JWT |
| `LandNexus-frontend` | React 18, TypeScript, Vite, Redux Toolkit, Tailwind CSS |
| `scripts` | PowerShell smoke tests and the end-to-end DEMO (`full-demo.ps1`) |
| `docs` | Setup guide, module notes, project status, frontend contract |

**Start here: [docs/SETUP_AND_RUN.md](docs/SETUP_AND_RUN.md).**

Important honesty notes
- All data in demos and tests is synthetic and labelled DEMO. Do not load real personal or land data.
- Payments are SIMULATED. There is no real PFMS/DBT connection and no bank details are stored.
- Compensation numbers come only from approved rate cards and rule sets; the DEMO rule set is illustrative, not a real law.
- No AI/ML/OCR is implemented. Maps are drawn from officer-entered GeoJSON; there is no satellite or Bhuvan integration.
- See `docs/PROJECT_STATUS.md` for what is done and what is pending.