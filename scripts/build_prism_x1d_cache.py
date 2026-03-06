#!/usr/bin/env python3
"""
Build JSON cache files for DIVER PRISM x1d FITS spectra.

Each input:
  <media_dir>/diver_prism_plots/jw_o002_<SOURCEID>_CLEAR_PRISM_x1d.fits

Produces:
  <media_dir>/diver_prism_plots/jw_o002_<SOURCEID>_CLEAR_PRISM_x1d.json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
from astropy.io import fits

DEFAULT_MEDIA_DIR = Path("/Users/sunfengwu/Downloads/emerald_msa_ptg-2026")
FILENAME_PATTERN = re.compile(
    r"^jw_o(?P<obs>\d+)_(?P<source>\d+)_CLEAR_PRISM_x1d\.fits$", re.IGNORECASE
)


def find_spectrum_table(hdul: fits.HDUList):
    required = {"WAVELENGTH", "FLUX", "FLUX_ERROR"}
    for hdu in hdul:
        columns = getattr(hdu, "columns", None)
        data = getattr(hdu, "data", None)
        if columns is None or data is None:
            continue
        names = {name.upper() for name in (columns.names or [])}
        if required.issubset(names):
            return hdu
    return None


def to_1d_float_array(values) -> np.ndarray:
    array = np.asarray(values)
    if array.ndim == 0:
        array = np.asarray([array], dtype=np.float64)
    else:
        array = array.reshape(-1).astype(np.float64, copy=False)
    return array


def build_cache_file(fits_path: Path) -> tuple[bool, str]:
    match = FILENAME_PATTERN.match(fits_path.name)
    if not match:
        return False, f"skip (name does not match x1d pattern): {fits_path.name}"

    with fits.open(fits_path) as hdul:
        table_hdu = find_spectrum_table(hdul)
        if table_hdu is None:
            return False, f"skip (required columns not found): {fits_path.name}"

        data = table_hdu.data
        wavelength = to_1d_float_array(data["WAVELENGTH"])
        flux = to_1d_float_array(data["FLUX"])
        flux_error = to_1d_float_array(data["FLUX_ERROR"])

        n = min(len(wavelength), len(flux), len(flux_error))
        wavelength = wavelength[:n]
        flux = flux[:n]
        flux_error = flux_error[:n]

        finite = np.isfinite(wavelength) & np.isfinite(flux) & np.isfinite(flux_error)
        wavelength = wavelength[finite]
        flux = flux[finite]
        flux_error = flux_error[finite]

        order = np.argsort(wavelength)
        wavelength = wavelength[order]
        flux = flux[order]
        flux_error = flux_error[order]

    payload = {
        "meta": {
            "source_id": match.group("source"),
            "observation_number": match.group("obs"),
            "input_file": fits_path.name,
            "wavelength_unit": "um",
            "flux_unit": "Jy",
            "flux_error_unit": "Jy",
            "schema_version": 1,
        },
        "spectrum": {
            "wavelength": wavelength.tolist(),
            "flux": flux.tolist(),
            "flux_error": flux_error.tolist(),
        },
        # Placeholder for future overlay/template comparisons.
        "templates": [],
    }

    output_path = fits_path.with_suffix(".json")
    output_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return True, f"ok: {output_path.name} ({len(wavelength)} samples)"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--media-dir",
        type=Path,
        default=DEFAULT_MEDIA_DIR,
        help="Base media directory containing diver_prism_plots/",
    )
    args = parser.parse_args()

    prism_dir = args.media_dir / "diver_prism_plots"
    if not prism_dir.exists():
        print(f"missing directory: {prism_dir}")
        return 1

    fits_files = sorted(prism_dir.glob("*_x1d.fits"))
    if not fits_files:
        print(f"no x1d fits files found in {prism_dir}")
        return 1

    ok_count = 0
    for fits_path in fits_files:
        ok, message = build_cache_file(fits_path)
        print(message)
        if ok:
            ok_count += 1

    print(f"done: {ok_count}/{len(fits_files)} cache files written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

