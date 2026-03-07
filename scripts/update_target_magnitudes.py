#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import math
import re
from pathlib import Path
from typing import Dict, Tuple

from astropy.io import fits


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate F200W/F444W magnitudes in targets.csv using JADES DR5 CIRC2 photometry."
    )
    parser.add_argument("--targets-csv", default="data/targets.csv")
    parser.add_argument("--vi-csv", default="data/DIVER_grating_vi.csv")
    parser.add_argument("--fits-path", required=True)
    parser.add_argument("--offset-threshold-arcsec", type=float, default=0.5)
    return parser.parse_args()


def mag_from_njy(flux_njy: float) -> float:
    if not math.isfinite(flux_njy) or flux_njy <= 0:
        return 99.0
    mag = -2.5 * math.log10(flux_njy / (3631e9))
    if not math.isfinite(mag):
        return 99.0
    return round(mag, 2)


def nearest_dr5(
    ra0: float, dec0: float, ids: list[str], ras: list[float], decs: list[float]
) -> Tuple[str, float]:
    cosd = math.cos(math.radians(dec0))
    best_idx = -1
    best_dist_sq = float("inf")
    for i, (ra, dec) in enumerate(zip(ras, decs)):
        d2 = ((ra - ra0) * cosd) ** 2 + (dec - dec0) ** 2
        if d2 < best_dist_sq:
            best_dist_sq = d2
            best_idx = i
    return ids[best_idx], math.sqrt(best_dist_sq) * 3600.0


def parse_dr5_from_notes(notes: str) -> str | None:
    match = re.search(r"DR5 nearest match ID\s+([0-9]+)", notes)
    return match.group(1) if match else None


def fmt_mag(value: float) -> str:
    if not math.isfinite(value) or value >= 99:
        return "99"
    return f"{value:.2f}"


def main() -> None:
    args = parse_args()
    targets_path = Path(args.targets_csv)
    vi_path = Path(args.vi_csv)
    fits_path = Path(args.fits_path)

    with targets_path.open() as handle:
        rows = list(csv.DictReader(handle))
        fieldnames = list(rows[0].keys()) if rows else []

    if "f200w" not in fieldnames:
        fieldnames.append("f200w")
    if "f444w" not in fieldnames:
        fieldnames.append("f444w")

    dr5_from_vi: Dict[str, str] = {}
    if vi_path.exists():
        with vi_path.open() as handle:
            for row in csv.DictReader(handle):
                source_id = (row.get("sourceid") or "").strip()
                sed = (row.get("JADES_seds") or "").strip()
                if not source_id:
                    continue
                match = re.search(r"/([0-9]+)_EAZY_SED\.png", sed)
                if match:
                    dr5_from_vi[source_id] = match.group(1)

    with fits.open(fits_path, memmap=True) as hdul:
        circ = hdul["CIRC"].data
        dr5_ids = [str(int(v)) for v in circ["ID"]]
        dr5_ras = [float(v) for v in circ["RA"]]
        dr5_decs = [float(v) for v in circ["DEC"]]
        circ_by_id = {str(int(v)): idx for idx, v in enumerate(circ["ID"])}

        flagged = []
        updated = 0
        for row in rows:
            name = (row.get("name") or "").strip()
            if not name.startswith("JADES-"):
                row["f200w"] = row.get("f200w", "99") or "99"
                row["f444w"] = row.get("f444w", "99") or "99"
                continue

            source_id = name[6:]
            notes = (row.get("notes") or "").strip()
            dr5_id = dr5_from_vi.get(source_id) or parse_dr5_from_notes(notes) or source_id

            circ_idx = circ_by_id.get(dr5_id)
            if circ_idx is None:
                try:
                    ra = float((row.get("ra") or "").strip())
                    dec = float((row.get("dec") or "").strip())
                except ValueError:
                    row["f200w"] = "99"
                    row["f444w"] = "99"
                    continue
                dr5_id, sep_arcsec = nearest_dr5(ra, dec, dr5_ids, dr5_ras, dr5_decs)
                circ_idx = circ_by_id.get(dr5_id)
                if sep_arcsec > args.offset_threshold_arcsec:
                    flagged.append((source_id, dr5_id, sep_arcsec))

            if circ_idx is None:
                row["f200w"] = "99"
                row["f444w"] = "99"
                continue

            flux_200 = float(circ["F200W_CIRC2"][circ_idx])
            flux_444 = float(circ["F444W_CIRC2"][circ_idx])
            flux_182 = float(circ["F182M_CIRC2"][circ_idx])
            flux_210 = float(circ["F210M_CIRC2"][circ_idx])

            mag_200 = mag_from_njy(flux_200)
            if math.isfinite(flux_444) and flux_444 > 0:
                mag_444 = mag_from_njy(flux_444)
            else:
                fallback_vals = [v for v in [flux_182, flux_210] if math.isfinite(v) and v > 0]
                if len(fallback_vals) == 2:
                    mag_444 = mag_from_njy(sum(fallback_vals) / 2.0)
                elif len(fallback_vals) == 1:
                    mag_444 = mag_from_njy(fallback_vals[0])
                else:
                    mag_444 = 99.0

            row["f200w"] = fmt_mag(mag_200)
            row["f444w"] = fmt_mag(mag_444)
            updated += 1

    with targets_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"updated_rows={updated}")
    print(f"flagged_gt_{args.offset_threshold_arcsec}arcsec={len(flagged)}")
    for source_id, dr5_id, sep in sorted(flagged, key=lambda item: item[2], reverse=True):
        print(f"flagged: source={source_id} dr5={dr5_id} sep_arcsec={sep:.3f}")


if __name__ == "__main__":
    main()
