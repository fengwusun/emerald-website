# EMERALD Team Website (JWST GO-7935)

Next.js + Vercel website for the EMERALD program with:

- Public program pages and Co-I roster.
- Team-only portal for target catalog and ancillary asset access.
- Strict schema validation for targets and team metadata.

## Quick Start

1. Install dependencies.
2. Copy `.env.example` to `.env.local` and set secrets.
   Set `EMERALD_LOCAL_MEDIA_DIR` to your local folder that contains source JPG/PNG files.
3. Run development server.

```bash
npm install
cp .env.example .env.local
npm run validate:data
npm run dev
```

## Key Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run validate:data
npm run test
```

## Data Sources

- Target catalog: `data/targets.csv`
- Co-I list: `data/coi.yaml`

See `docs/data-maintenance.md` for required schema and update workflow.
