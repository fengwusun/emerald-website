# Changelog

## Unreleased

### Added

- Merged EMERALD and DIVER public-facing site content under the EMERALD+DIVER name.
- Password-protected science-projects page with a code-managed announced-project list.
- Portal target quick tags and emission-line tags.
- Import of DIVER grating VI tags from `data/DIVER_grating_vi.csv`, including `Continuum_detected`.
- Instrument-aware target metadata and filtering in the portal.

### Changed

- Portal and science-project access now use password-protected server-side session logic.
- Portal target filtering now supports multiple selected quick tags, emission-line tags, and instruments.
- Instrument metadata now supports multiple instruments per source.
- Observation status is now tracked per instrument/observation mode instead of only once per source.
- EMERALD targets default to `G395M/F290LP`.
- Targets present in the DIVER grating VI catalog also receive `G140M/F070LP` and an observed DIVER mode.
- Science-project content is now maintained directly in code instead of through user submission/join workflows.
- Science-project placeholders now use generic titles, descriptions, names, and emails until real projects are announced.

### Fixed

- Comment/tag button text color inherited incorrectly from global button styles.
- Quick tags containing commas can now be selected and unselected correctly.
