#!/usr/bin/env python3
"""
Build JSON cache files for EMERALD G395M x1d FITS spectra.

Each input:
  <media_dir>/emerald_grating_plots/jw07935<OBS><VISIT>_F290LP-G395M_s<EMRID>_x1d.fits

Produces:
  <media_dir>/emerald_grating_plots/jw07935<OBS><VISIT>_F290LP-G395M_s<EMRID>_x1d.json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
from astropy.io import fits

SPEED_OF_LIGHT_CM_S = 2.99792458e10

DEFAULT_MEDIA_DIR = Path("/Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026")
FILENAME_PATTERN = re.compile(
    r"^jw07935(?P<obs>\d{3})(?P<visit>\d{3})_(?P<filter>[A-Za-z0-9]+)-(?P<grating>[A-Za-z0-9]+)_s(?P<source>\d+)_x1d\.fits$",
    re.IGNORECASE,
)
REQUIRED_SETS = [
    ("WAVELENGTH", "FLUX", "FLUX_ERROR"),
    ("WAVELENGTH", "FLUX", "ERROR"),
    ("WAVELENGTH", "SCI", "ERR"),
]


def to_1d_float_array(values) -> np.ndarray:
    array = np.asarray(values)
    if array.ndim == 0:
        array = np.asarray([array], dtype=np.float64)
    else:
        array = array.reshape(-1).astype(np.float64, copy=False)
    return array


def find_spectrum_table(hdul: fits.HDUList):
    for hdu in hdul:
        columns = getattr(hdu, "columns", None)
        data = getattr(hdu, "data", None)
        if columns is None or data is None:
            continue
        names = [name.upper() for name in (columns.names or [])]
        name_set = set(names)
        for trio in REQUIRED_SETS:
            if set(trio).issubset(name_set):
                return hdu, trio
    return None, None


def extract_unit(hdu, column_name: str, fallback: str) -> str:
    columns = getattr(hdu, "columns", None)
    if columns is not None:
        for column in columns:
            if getattr(column, "name", "").upper() == column_name.upper():
                unit = getattr(column, "unit", None)
                if isinstance(unit, str) and unit.strip():
                    return unit.strip()
    header = getattr(hdu, "header", None)
    if header is not None:
        for index, name in enumerate(getattr(columns, "names", []) or [], start=1):
            if str(name).upper() == column_name.upper():
                unit = header.get(f"TUNIT{index}")
                if isinstance(unit, str) and unit.strip():
                    return unit.strip()
    return fallback


def build_cache_file(fits_path: Path) -> tuple[bool, str]:
    match = FILENAME_PATTERN.match(fits_path.name)
    if not match:
        return False, f"skip (name does not match EMERALD x1d pattern): {fits_path.name}"

    with fits.open(fits_path) as hdul:
        table_hdu, columns = find_spectrum_table(hdul)
        if table_hdu is None or columns is None:
            return False, f"skip (required columns not found): {fits_path.name}"

        wavelength_col, flux_col, fluxerr_col = columns
        data = table_hdu.data
        wavelength = to_1d_float_array(data[wavelength_col])
        flux = to_1d_float_array(data[flux_col])
        flux_error = to_1d_float_array(data[fluxerr_col])

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

        wavelength_unit = extract_unit(table_hdu, wavelength_col, "um")
        flux_unit_in = extract_unit(table_hdu, flux_col, "Jy")
        flux_error_unit_in = extract_unit(table_hdu, fluxerr_col, flux_unit_in)

        if flux_unit_in.strip().lower() == "jy":
            lambda_um = wavelength
            scale = SPEED_OF_LIGHT_CM_S * 1e-23 / np.square(lambda_um)
            flux = flux * scale
            flux_error = flux_error * scale
            flux_unit = "erg/s/cm^2/A"
            flux_error_unit = "erg/s/cm^2/A"
        else:
            flux_unit = flux_unit_in
            flux_error_unit = flux_error_unit_in

    payload = {
        "meta": {
            "source_id": str(int(match.group("source"))),
            "emerald_id": f"EMR-{int(match.group('source'))}",
            "observation_number": match.group("obs"),
            "visit_number": match.group("visit"),
            "program_id": "7935",
            "filter": match.group("filter").upper(),
            "grating": match.group("grating").upper(),
            "input_file": fits_path.name,
            "wavelength_unit": wavelength_unit,
            "flux_unit": flux_unit,
            "flux_error_unit": flux_error_unit,
            "schema_version": 1,
        },
        "spectrum": {
            "wavelength": wavelength.tolist(),
            "flux": flux.tolist(),
            "flux_error": flux_error.tolist(),
        },
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
        help="Base media directory containing emerald_grating_plots/",
    )
    args = parser.parse_args()

    emerald_dir = args.media_dir / "emerald_grating_plots"
    if not emerald_dir.exists():
        print(f"missing directory: {emerald_dir}")
        return 1

    fits_files = sorted(emerald_dir.glob("*_x1d.fits"))
    if not fits_files:
        print(f"no x1d fits files found in {emerald_dir}")
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
