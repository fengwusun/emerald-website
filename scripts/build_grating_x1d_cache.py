#!/usr/bin/env python3
"""
Build JSON cache files for DIVER grating 1D CSV spectra.

Input files:
  <media_dir>/diver_grating_plots/jw_o001_8018_<SOURCEID>_F070LP_G140M_*bundle_1d.csv

Output files (one per extraction profile):
  <same_dir>/<basename>__<profile>_x1d.json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

DEFAULT_MEDIA_DIR = Path("/Users/sunfengwu/Downloads/emerald_msa_ptg-2026")
CSV_PATTERN = re.compile(
    r"^jw_o(?P<obs>\d+)_(?P<program>\d+)_(?P<source>\d+)_(?P<filter>[A-Za-z0-9]+)_(?P<grating>[A-Za-z0-9]+)_.*bundle_1d\.csv$",
    re.IGNORECASE,
)


def profile_columns(fieldnames: list[str]) -> list[tuple[str, str]]:
    columns = [name.strip() for name in fieldnames]
    flux_cols = [name for name in columns if re.match(r"^flux_[-A-Za-z0-9_]+_cgs$", name, re.IGNORECASE)]
    out: list[tuple[str, str]] = []
    for flux_col in flux_cols:
      profile = re.sub(r"^flux_|_cgs$", "", flux_col, flags=re.IGNORECASE)
      err_col = f"fluxerr_{profile}_cgs"
      if err_col in columns:
          out.append((flux_col, profile))
    return out


def to_float(value: str) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def build_cache_for_file(csv_path: Path) -> tuple[int, list[str]]:
    match = CSV_PATTERN.match(csv_path.name)
    if not match:
        return 0, [f"skip (name mismatch): {csv_path.name}"]

    messages: list[str] = []
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return 0, [f"skip (missing header): {csv_path.name}"]
        profiles = profile_columns(reader.fieldnames)
        if not profiles:
            return 0, [f"skip (no flux/fluxerr profile columns): {csv_path.name}"]
        rows = list(reader)

    written = 0
    for flux_col, profile in profiles:
        err_col = f"fluxerr_{profile}_cgs"
        wavelength = []
        flux = []
        flux_err = []
        for row in rows:
            wave_angstrom = to_float(row.get("wavelength_angstrom", ""))
            f_lambda = to_float(row.get(flux_col, ""))
            f_lambda_err = to_float(row.get(err_col, ""))
            if wave_angstrom is None or f_lambda is None or f_lambda_err is None:
                continue
            wavelength.append(wave_angstrom * 1e-4)  # Angstrom -> micron
            flux.append(f_lambda)
            flux_err.append(f_lambda_err)

        order = sorted(range(len(wavelength)), key=lambda i: wavelength[i])
        wavelength = [wavelength[i] for i in order]
        flux = [flux[i] for i in order]
        flux_err = [flux_err[i] for i in order]

        payload = {
            "meta": {
                "source_id": match.group("source"),
                "observation_number": match.group("obs"),
                "program_id": match.group("program"),
                "filter": match.group("filter").upper(),
                "grating": match.group("grating").upper(),
                "input_file": csv_path.name,
                "extraction_profile": profile,
                "wavelength_unit": "um",
                "flux_unit": "erg/s/cm^2/A",
                "flux_error_unit": "erg/s/cm^2/A",
                "schema_version": 1,
            },
            "spectrum": {
                "wavelength": wavelength,
                "flux": flux,
                "flux_error": flux_err,
            },
            "templates": [],
        }

        output_name = csv_path.name.replace(".csv", f"__{profile}_x1d.json")
        output_path = csv_path.with_name(output_name)
        output_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        messages.append(f"ok: {output_name} ({len(wavelength)} samples)")
        written += 1

    return written, messages


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--media-dir",
        type=Path,
        default=DEFAULT_MEDIA_DIR,
        help="Base media directory containing diver_grating_plots/",
    )
    args = parser.parse_args()

    grating_dir = args.media_dir / "diver_grating_plots"
    if not grating_dir.exists():
        print(f"missing directory: {grating_dir}")
        return 1

    csv_files = sorted(grating_dir.glob("*bundle_1d.csv"))
    if not csv_files:
        print(f"no grating CSV files found in {grating_dir}")
        return 1

    total_written = 0
    for csv_path in csv_files:
        written, messages = build_cache_for_file(csv_path)
        for message in messages:
            print(message)
        total_written += written

    print(f"done: {total_written} JSON cache files written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
