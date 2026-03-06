# Data Maintenance Guide

## Files

- `data/targets.csv`: authoritative target catalog.
- `data/coi.yaml`: Co-I roster.

## Target Schema (CSV columns)

- `emerald_id` (string, required, e.g. `EMR-0001`)
- `name` (string, required)
- `ra` (number, required)
- `dec` (number, required)
- `z_spec` (number >= 0, required)
- `status` (string, required; examples: `queued`, `observed`, `processed`)
- `priority` (`high|medium|low`, required)
- `jwst_program_id` (string, required)
- `notes` (string, optional)
- `ancillary_assets` (JSON array string)

### Ancillary Asset Object

- `asset_type`: `image|sed|spectrum|other`
- `label`: display label
- `storage_key`: object-storage key, expected to start with `targets/`
- `preview_url`: optional absolute URL or internal path (for example `/api/targets/image?file=...`)
- `access_level`: `team|public`

## Co-I Schema (`coi.yaml` list)

- `name` (required)
- `role` (required)
- `affiliation` (required)
- `profile_url` (optional URL)
- `orcid` (optional format `0000-0000-0000-0000`)

## PR Checklist

- [ ] Data edited only in `data/targets.csv` and/or `data/coi.yaml`
- [ ] `npm run validate:data` passes
- [ ] `npm run test` passes
- [ ] New assets uploaded to object storage with expected `targets/...` key prefix
