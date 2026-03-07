#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import math
import re
from pathlib import Path
from typing import Dict, Iterable, Tuple

from astropy.io import fits


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export per-source JADES DR5 CIRC/KRON photometry rows as CSV assets."
    )
    parser.add_argument(
        "--targets-csv",
        default="data/targets.csv",
        help="Path to targets.csv",
    )
    parser.add_argument(
        "--vi-csv",
        default="data/DIVER_grating_vi.csv",
        help="Path to DIVER_grating_vi.csv",
    )
    parser.add_argument(
        "--fits-path",
        required=True,
        help="Path to JADES DR5 FITS catalog",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Output directory for generated photometry CSV files",
    )
    return parser.parse_args()


def read_targets_source_ids(path: Path) -> Iterable[Tuple[str, str, float | None, float | None]]:
    with path.open() as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name = (row.get("name") or "").strip()
            if not name.startswith("JADES-"):
                continue
            source_id = name[6:]
            notes = (row.get("notes") or "").strip()
            try:
                ra = float((row.get("ra") or "").strip())
            except ValueError:
                ra = None
            try:
                dec = float((row.get("dec") or "").strip())
            except ValueError:
                dec = None
            yield source_id, notes, ra, dec


def read_vi_dr5_map(path: Path) -> Dict[str, str]:
    dr5_by_source: Dict[str, str] = {}
    if not path.exists():
        return dr5_by_source
    with path.open() as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            source_id = (row.get("sourceid") or "").strip()
            if not source_id:
                continue
            sed = (row.get("JADES_seds") or "").strip()
            match = re.search(r"/([0-9]+)_EAZY_SED\.png", sed)
            if match:
                dr5_by_source[source_id] = match.group(1)
    return dr5_by_source


def parse_dr5_from_notes(notes: str) -> str | None:
    match = re.search(r"DR5 nearest match ID\s+([0-9]+)", notes)
    if match:
        return match.group(1)
    return None


def fit_row_to_dict(columns: Iterable[str], row) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for key in columns:
        value = row[key]
        if hasattr(value, "item"):
            value = value.item()
        out[key] = str(value)
    return out


def nearest_dr5(
    ra0: float, dec0: float, dr5_ids: list[str], dr5_ra: list[float], dr5_dec: list[float]
) -> Tuple[str, float]:
    cosd = math.cos(math.radians(dec0))
    best_idx = -1
    best_dist_sq = float("inf")
    for i, (ra, dec) in enumerate(zip(dr5_ra, dr5_dec)):
        dist_sq = ((ra - ra0) * cosd) ** 2 + (dec - dec0) ** 2
        if dist_sq < best_dist_sq:
            best_dist_sq = dist_sq
            best_idx = i
    separation_arcsec = math.sqrt(best_dist_sq) * 3600.0
    return dr5_ids[best_idx], separation_arcsec


def main() -> None:
    args = parse_args()
    targets_csv = Path(args.targets_csv)
    vi_csv = Path(args.vi_csv)
    fits_path = Path(args.fits_path)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    dr5_from_vi = read_vi_dr5_map(vi_csv)
    sources = list(read_targets_source_ids(targets_csv))

    with fits.open(fits_path, memmap=True) as hdul:
        circ = hdul["CIRC"].data
        kron = hdul["KRON"].data
        circ_cols = list(circ.names)
        kron_cols = list(kron.names)
        circ_by_id = {str(int(value)): idx for idx, value in enumerate(circ["ID"])}
        kron_by_id = {str(int(value)): idx for idx, value in enumerate(kron["ID"])}
        dr5_ids = [str(int(value)) for value in circ["ID"]]
        dr5_ra = [float(value) for value in circ["RA"]]
        dr5_dec = [float(value) for value in circ["DEC"]]

        generated = 0
        missing = 0
        flagged_large_offset: list[tuple[str, str, float]] = []

        for source_id, notes, source_ra, source_dec in sources:
            dr5_id = dr5_from_vi.get(source_id)
            if not dr5_id:
                dr5_id = parse_dr5_from_notes(notes)
            if not dr5_id:
                dr5_id = source_id

            circ_idx = circ_by_id.get(dr5_id)
            kron_idx = kron_by_id.get(dr5_id)
            if circ_idx is None or kron_idx is None:
                if source_ra is None or source_dec is None:
                    missing += 1
                    continue
                matched_dr5_id, separation_arcsec = nearest_dr5(
                    source_ra, source_dec, dr5_ids, dr5_ra, dr5_dec
                )
                dr5_id = matched_dr5_id
                circ_idx = circ_by_id.get(dr5_id)
                kron_idx = kron_by_id.get(dr5_id)
                if circ_idx is None or kron_idx is None:
                    missing += 1
                    continue
                if separation_arcsec > 0.5:
                    flagged_large_offset.append((source_id, dr5_id, separation_arcsec))

            circ_row = fit_row_to_dict(circ_cols, circ[circ_idx])
            kron_row = fit_row_to_dict(kron_cols, kron[kron_idx])

            circ_path = output_dir / f"jades_{source_id}_CIRC.csv"
            with circ_path.open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=circ_cols)
                writer.writeheader()
                writer.writerow(circ_row)

            kron_path = output_dir / f"jades_{source_id}_KRON.csv"
            with kron_path.open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=kron_cols)
                writer.writeheader()
                writer.writerow(kron_row)

            generated += 1

    print(f"generated_sources={generated}")
    print(f"missing_sources={missing}")
    print(f"output_dir={output_dir}")
    print(f"flagged_gt_0p5arcsec={len(flagged_large_offset)}")
    for source_id, dr5_id, separation_arcsec in sorted(
        flagged_large_offset, key=lambda item: item[2], reverse=True
    ):
        print(f"flagged: source={source_id} dr5={dr5_id} sep_arcsec={separation_arcsec:.3f}")


if __name__ == "__main__":
    main()
