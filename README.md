# EMERALD+DIVER Website

Next.js website for the merged JWST GO-7935 EMERALD and GO-8018 DIVER collaboration.

It includes:

- Public program pages for overview, science goals, observing plan, team, and data policy.
- Password-protected portal pages for the target catalog, quick interactive spectrum viewer, redshift reports, and internal links.
- Science-projects page with Google Sheet integration.
- Interactive 1D spectrum viewing for DIVER PRISM, DIVER G140M/F070LP grating, and EMERALD G395M/F290LP grating data.

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

Required portal settings:

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
- Redshift submissions log: `data/redshift-submissions.ndjson`
- Science-project catalog: `lib/science-projects-catalog.ts`

## Media Layout

Default media roots:

- Local: `/Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026`
- Server: `/data/emerald/media`

Important subdirectories:

- `diver_prism_plots/`
  - PRISM PNG quicklooks
  - PRISM `*_x1d.fits`, `*_x1d.json`
  - PRISM `*_s2d.fits`
  - PRISM joint line-fit JSON products
- `diver_grating_plots/`
  - DIVER G140M PNG quicklooks
  - DIVER `bundle_1d.csv`
  - DIVER generated `__*_x1d.json`
- `emerald_grating_plots/`
  - EMERALD G395M PDF quicklooks
  - EMERALD G395M PNG quicklooks converted from PDF
  - EMERALD `*_x1d.fits`, `*_x1d.json`
  - EMERALD `*_s2d.fits`
- `jades_photometry/`
  - JADES DR5 per-source CIRC and KRON CSV products

## Target Catalog Notes

- EMERALD catalog targets default to instrument `G395M/F290LP`.
- Targets found in `DIVER_grating_vi.csv` also receive instrument `G140M/F070LP`.
- PRISM products add instrument `PRISM`.
- A source can carry more than one instrument label.
- Instrument status is tracked per observation mode, not only once per source.
- Emission-line tags are imported from the DIVER grating VI table, including `Continuum_detected`.
- Quick tags are derived from notes and standardized for selected categories such as AGN, DSFG, EMPG candidate, JADES-NIRSpec source, and literature UV emitters.
- The interactive viewer loads JSON-backed 1D spectra only, not FITS directly.
- DIVER G140M and EMERALD G395M JSON spectra are both stored in `f_lambda` units (`erg/s/cm^2/A`) with wavelength in `um`.
- EMERALD G395M hover previews in the catalog prefer PNG quicklooks; PDF files remain downloadable assets.

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

### Build 1D Spectrum Cache (DIVER G140M grating)

Interactive DIVER grating plotting uses precomputed JSON cache files next to CSV files in:
`<EMERALD_LOCAL_MEDIA_DIR>/diver_grating_plots/`.

Run:

```bash
python3 scripts/build_grating_x1d_cache.py --media-dir /path/to/media
```

### Build 1D Spectrum Cache (EMERALD G395M x1d)

Interactive EMERALD G395M plotting uses precomputed JSON cache files next to FITS files in:
`<EMERALD_LOCAL_MEDIA_DIR>/emerald_grating_plots/`.

Run:

```bash
python3 scripts/build_emerald_g395m_x1d_cache.py --media-dir /path/to/media
```

Example with the `stenv` conda environment:

```bash
/Users/sunfengwu/anaconda3/bin/conda run --no-capture-output -n stenv \
  python scripts/build_emerald_g395m_x1d_cache.py --media-dir /data/emerald/media
```

### Convert EMERALD G395M PDF Quicklooks to PNG

The `G395M/F290LP` hover preview in the target catalog uses PNG previews derived from PDF quicklooks.

Run locally:

```bash
sh scripts/convert_emerald_g395m_pdfs_to_png.sh \
  /Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026/emerald_grating_plots
```

Current converter note:

- The script uses macOS `qlmanage`.

## Redshift Submission Workflow

- Live redshift reports are stored in `data/redshift-submissions.ndjson`.
- The portal target catalog and quick interactive viewer read the latest submitted redshift in real time.
- On the server, this file must remain writable by the service user.

Useful helper:

```bash
./zspec_to_local.sh
```

## Science Projects

The science-projects page is backed by Google Sheets for collaborative project entry and tracking.

## Validation

Recommended before deployment:

```bash
npm run lint
npm run typecheck
npm run validate:data
npm run build
```

## Deployment Notes (magnif)

Server repo:

- `/data/emerald/emerald`

Server media root:

- `/data/emerald/media`

Systemd service:

- `emerald.service`

Typical update flow:

```bash
cd /data/emerald/emerald
git pull origin main
npm run build
sudo systemctl restart emerald.service
```

Useful checks:

```bash
systemctl is-active emerald.service
curl -IL https://magnif.as.arizona.edu/emerald/team
```

Known permission issue:

- If build fails with `EACCES` under `.next/diagnostics`, fix ownership first:

```bash
sudo chown -R fsun:jades /data/emerald/emerald/.next
```

Important runtime-writable file:

- `/data/emerald/emerald/data/redshift-submissions.ndjson`

This should remain writable by the service user (`emeraldsvc` on server setups using the systemd service).
