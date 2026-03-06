# EMERALD+DIVER Website

Next.js website for the merged JWST GO-7935 EMERALD and GO-8018 DIVER collaboration.

It includes:

- Public program pages for program overview, science goals, observing plan, team, and data policy.
- Password-protected portal pages for the target catalog and team-only assets.
- A password-protected science-projects page that shows a code-managed list of placeholder announced projects.
- Portal target filtering by IDs, status, instrument, quick tags, emission-line tags, redshift, and cone search.

## Quick Start

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Set required passwords and cookie secrets.
4. Run the development server.

```bash
npm install
cp .env.example .env.local
npm run validate:data
npm run dev
```

If Next.js build output gets into a bad local state, clean `.next` first:

```bash
npm run clean:next
npm run dev
```

## Environment

Required server settings:

- `EMERALD_PORTAL_PASSWORD`
- `EMERALD_PORTAL_COOKIE_SECRET`

Optional storage and media settings:

- `EMERALD_SIGNED_URL_TTL_SECONDS`
- `AWS_REGION`
- `EMERALD_ASSET_BUCKET`
- `EMERALD_ASSET_PREFIX`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ENDPOINT_URL`
- `EMERALD_LOCAL_MEDIA_DIR`
- `NEXT_PUBLIC_BASE_PATH`

If `EMERALD_LOCAL_MEDIA_DIR` is not set, production defaults to `/data/emerald/media`.

`.env.local` should stay gitignored.

## Key Commands

```bash
npm run dev
npm run dev:clean
npm run build
npm run start
npm run lint
npm run typecheck
npm run validate:data
npm run test
```

## Data Files

- Target catalog: `data/targets.csv`
- DIVER grating VI catalog: `data/DIVER_grating_vi.csv`
- Co-I list: `data/coi.yaml`
- Science-project catalog: `lib/science-projects-catalog.ts`

## Target Catalog Notes

- EMERALD catalog targets default to instrument `G395M/F290LP`.
- Targets found in `DIVER_grating_vi` also receive instrument `G140M/F070LP`.
- A source can carry more than one instrument label.
- Instrument status is tracked per observation mode, not only once per source.
- Emission-line tags are imported from the DIVER grating VI table, including `Continuum_detected`.
- Quick tags are derived from notes and standardized for selected categories such as literature UV emitters, JADES-NIRSpec sources, and AGNs.
- PRISM x1d FITS files can be viewed interactively in the target detail page after generating JSON cache files.

### Build 1D Spectrum Cache (PRISM x1d)

Interactive x1d plotting uses precomputed JSON cache files next to FITS files in:
`<EMERALD_LOCAL_MEDIA_DIR>/diver_prism_plots/`.

Run:

```bash
python3 scripts/build_prism_x1d_cache.py --media-dir /path/to/media
```

Example on server:

```bash
python3 scripts/build_prism_x1d_cache.py --media-dir /data/emerald/media
```

## Science Projects

The science-projects page is static and code-managed:

- Edit `lib/science-projects-catalog.ts` to update announced projects.
- The current catalog is intentionally placeholder-only until projects are announced.
- Each project entry includes title, description, lead name, lead email, and an optional recent update link.
- The page text asks collaborators to brainstorm ideas and contact the PI before announcing projects in Slack or the group email.
- The page does not accept user submissions or join requests.

## Validation

Recommended before deployment:

```bash
npm run lint
npm run typecheck
npm run validate:data
npm run build
```
