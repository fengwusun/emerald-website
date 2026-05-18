# Project Context

This file is a quick handoff/reference for the current state of the EMERALD+DIVER website.

## Purpose

The site serves two audiences:

- Public-facing program pages for EMERALD and DIVER collaboration context.
- Team-only portal for target inspection, interactive spectra, redshift reporting, and internal coordination.

## Main Data Sources

- `data/targets.csv`
  - master target catalog used by the portal
- `data/coi.yaml`
  - PI / co-PI / co-I contact list
- `data/redshift-submissions.ndjson`
  - append-only report log for submitted best redshifts
- media root
  - local: `/Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026`
  - server: `/data/emerald/media`

## Important Media Subdirectories

- `diver_prism_plots/`
  - PRISM quicklooks, x1d/s2d FITS, x1d JSON, line-fit JSON
- `diver_grating_plots/`
  - DIVER G140M PNG quicklooks, CSV 1D spectra, generated x1d JSON
- `emerald_grating_plots/`
  - EMERALD G395M PDF quicklooks
  - EMERALD G395M PNG quicklooks converted from PDF
  - EMERALD G395M x1d FITS and generated x1d JSON
  - EMERALD G395M s2d FITS
- `jades_photometry/`
  - JADES DR5 photometry CSV exports

## Current Spectrum Viewer Conventions

- Viewer only loads JSON-backed 1D spectra.
- DIVER G140M JSON:
  - wavelength in `um`
  - flux / error in `erg/s/cm^2/A`
- EMERALD G395M JSON now follows the same convention:
  - wavelength in `um`
  - flux / error in `erg/s/cm^2/A`
- PRISM JSON currently follows its own cache builder and viewer metadata path.

## Important Scripts

- `scripts/build_prism_x1d_cache.py`
  - builds PRISM x1d JSON cache files
- `scripts/build_grating_x1d_cache.py`
  - builds DIVER G140M JSON cache files from CSV
- `scripts/build_emerald_g395m_x1d_cache.py`
  - builds EMERALD G395M JSON cache files from x1d FITS
- `scripts/convert_emerald_g395m_pdfs_to_png.sh`
  - converts EMERALD G395M PDF quicklooks to PNG hover previews
  - currently macOS `qlmanage` based
- `scripts/update_targets_zspec_from_submissions.py`
  - updates `targets.csv` from latest submission values if needed offline

## Current UI Behaviors

- Portal target catalog:
  - supports search, tags, instrument filters, redshift range, cone search, pagination, URL-synced filtering
- Instrument hover previews:
  - `G140M/F070LP` -> PNG quicklook
  - `PRISM` -> PNG quicklook
  - `G395M/F290LP` -> PNG quicklook converted from PDF
- Target detail page:
  - shows ancillary assets, previews, FitsMap and EAZY SED links, interactive 1D viewer
- Quick Interactive page:
  - source browser + same 1D viewer
- Redshift Reports page:
  - reads `data/redshift-submissions.ndjson`

## Server Deployment Notes

Main server:

- `magnif.as.arizona.edu`
- repo path: `/data/emerald/emerald`
- media path: `/data/emerald/media`
- service: `emerald.service`

Typical deployment flow:

```bash
cd /data/emerald/emerald
git pull origin main
npm run build
sudo systemctl restart emerald.service
```

Verification:

```bash
systemctl is-active emerald.service
curl -IL https://magnif.as.arizona.edu/emerald/team
```

## Known Permission/Operations Issues

- `.next/diagnostics` can become root-owned on the server and block future builds.
  - fix with:

```bash
sudo chown -R fsun:jades /data/emerald/emerald/.next
```

- `data/redshift-submissions.ndjson` must stay writable by the service user.
- Server pulls can fail if runtime-written files are tracked or if ownership is mixed.

## Notes For Future Work

- If EMERALD G395M PDFs are updated, rerun the PNG conversion script locally and sync PNGs to server media.
- If EMERALD G395M FITS are updated, rerun the x1d JSON cache build locally and/or on server.
- When debugging spectrum viewer range issues, check:
  - `components/spectrum-1d-viewer.tsx`
  - payload unit metadata
  - Plotly reset/purge behavior on asset switch
