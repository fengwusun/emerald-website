#!/usr/bin/env python3
"""Generate Halpha diagnostics from joint line-fit JSON files."""

from __future__ import annotations

import argparse
import glob
import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


def luminosity_distance_cm(z: float, h0: float = 70.0, om: float = 0.3) -> float:
    """Flat LCDM luminosity distance in cm using simple numerical integration."""
    c_km_s = 299792.458
    ol = 1.0 - om
    n = 2000
    zz = np.linspace(0.0, z, n)
    ez = np.sqrt(om * (1 + zz) ** 3 + ol)
    integral = np.trapz(1.0 / ez, zz)
    dc_mpc = (c_km_s / h0) * integral
    dl_mpc = (1 + z) * dc_mpc
    mpc_to_cm = 3.085677581e24
    return float(dl_mpc * mpc_to_cm)


def find_line(rows: list[dict], line_id: str) -> dict | None:
    for r in rows:
        if r.get("line_id") == line_id:
            return r
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fits-dir", type=Path, required=True, help="Directory with *_joint_lsf_fit.json")
    ap.add_argument("--output-dir", type=Path, required=True, help="Where to save diagnostic plots")
    ap.add_argument("--snr-threshold", type=float, default=3.0)
    ap.add_argument("--ha-flux-max", type=float, default=1e-13, help="Exclude sources with Halpha flux above this.")
    ap.add_argument(
        "--ha-hb-ratio-max",
        type=float,
        default=300.0,
        help="Exclude sources with Halpha/Hbeta ratio above this when ratio is finite.",
    )
    args = ap.parse_args()

    files = sorted(glob.glob(str(args.fits_dir / "*_joint_lsf_fit.json")))
    out_rows = []
    for fp in files:
        try:
            d = json.loads(Path(fp).read_text(encoding="utf-8"))
        except Exception:
            continue
        z = float((d.get("meta") or {}).get("z", float("nan")))
        if not math.isfinite(z) or z <= 0:
            continue
        rows = d.get("line_results") or []
        ha = find_line(rows, "ha_nii_complex")
        hb = find_line(rows, "hbeta")
        if not ha:
            continue
        try:
            ha_flux = float(ha.get("flux", float("nan")))
            ha_snr = float(ha.get("snr", float("nan")))
        except Exception:
            continue
        if not (math.isfinite(ha_flux) and math.isfinite(ha_snr) and ha_flux > 0 and ha_snr >= args.snr_threshold):
            continue

        dl = luminosity_distance_cm(z)
        lha = 4.0 * math.pi * dl * dl * ha_flux

        hb_flux = float("nan")
        hb_snr = float("nan")
        ratio = float("nan")
        if hb is not None:
            hb_flux = float(hb.get("flux", float("nan")))
            hb_snr = float(hb.get("snr", float("nan")))
            if math.isfinite(hb_flux) and hb_flux > 0 and math.isfinite(hb_snr) and hb_snr >= args.snr_threshold:
                ratio = ha_flux / hb_flux

        out_rows.append(
            {
                "file": fp,
                "z": z,
                "ha_flux": ha_flux,
                "ha_snr": ha_snr,
                "ha_lum": lha,
                "hb_flux": hb_flux,
                "hb_snr": hb_snr,
                "ha_hb_ratio": ratio,
            }
        )

    if not out_rows:
        print("no rows after filtering")
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)

    z = np.array([r["z"] for r in out_rows], dtype=float)
    ha_flux = np.array([r["ha_flux"] for r in out_rows], dtype=float)
    ha_snr = np.array([r["ha_snr"] for r in out_rows], dtype=float)
    ha_lum = np.array([r["ha_lum"] for r in out_rows], dtype=float)
    ratio = np.array([r["ha_hb_ratio"] for r in out_rows], dtype=float)
    keep = np.ones(len(out_rows), dtype=bool)
    if math.isfinite(args.ha_flux_max) and args.ha_flux_max > 0:
        keep &= ha_flux <= args.ha_flux_max
    if math.isfinite(args.ha_hb_ratio_max) and args.ha_hb_ratio_max > 0:
        ratio_finite = np.isfinite(ratio)
        keep &= (~ratio_finite) | (ratio <= args.ha_hb_ratio_max)
    n_removed = int(np.sum(~keep))
    z = z[keep]
    ha_flux = ha_flux[keep]
    ha_snr = ha_snr[keep]
    ha_lum = ha_lum[keep]
    ratio = ratio[keep]
    ratio_m = np.isfinite(ratio) & (ratio > 0)

    # 1) L(Ha) vs z
    fig, ax = plt.subplots(figsize=(8, 5))
    sc = ax.scatter(z, np.log10(ha_lum), c=ha_snr, s=22, cmap="viridis", alpha=0.9, edgecolors="none")
    cb = fig.colorbar(sc, ax=ax, pad=0.01)
    cb.set_label("Hα S/N")
    ax.set_xlabel("Redshift")
    ax.set_ylabel("log10 L(Hα+[NII]) [erg/s]")
    ax.set_title("Hα+[NII] Luminosity vs Redshift (S/N>3)")
    ax.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(args.output_dir / "halpha_luminosity_vs_redshift.png", dpi=180)
    plt.close(fig)

    # 2) Halpha/Hbeta vs z
    fig, ax = plt.subplots(figsize=(8, 5))
    if np.any(ratio_m):
        ax.scatter(z[ratio_m], ratio[ratio_m], s=24, c="#1f77b4", alpha=0.85, edgecolors="none")
    ax.set_xlabel("Redshift")
    ax.set_ylabel("Hα+[NII] / Hβ")
    ax.set_title("Hα+[NII] to Hβ Ratio vs Redshift (both S/N>3)")
    ax.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(args.output_dir / "halpha_hbeta_ratio_vs_redshift.png", dpi=180)
    plt.close(fig)

    # 3) Histogram of Halpha fluxes
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(np.log10(ha_flux), bins=28, color="#2ca25f", alpha=0.9, edgecolor="white")
    ax.set_xlabel("log10 Flux(Hα+[NII]) [erg s$^{-1}$ cm$^{-2}$]")
    ax.set_ylabel("Number of sources")
    ax.set_title("Histogram of Hα+[NII] Fluxes (S/N>3)")
    ax.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(args.output_dir / "halpha_flux_histogram.png", dpi=180)
    plt.close(fig)

    # Optional extra: ratio histogram
    if np.any(ratio_m):
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.hist(ratio[ratio_m], bins=24, color="#3182bd", alpha=0.9, edgecolor="white")
        ax.set_xlabel("Hα+[NII] / Hβ")
        ax.set_ylabel("Number of sources")
        ax.set_title("Histogram of Hα+[NII] / Hβ (both S/N>3)")
        ax.grid(alpha=0.2)
        fig.tight_layout()
        fig.savefig(args.output_dir / "halpha_hbeta_ratio_histogram.png", dpi=180)
        plt.close(fig)

    summary = {
        "n_fit_files": len(files),
        "n_halpha_snr_gt_threshold": int(len(out_rows)),
        "n_after_outlier_filter": int(np.sum(keep)),
        "n_removed_outliers": n_removed,
        "n_halpha_hbeta_both_snr_gt_threshold": int(np.sum(ratio_m)),
        "snr_threshold": args.snr_threshold,
        "ha_flux_max": args.ha_flux_max,
        "ha_hb_ratio_max": args.ha_hb_ratio_max,
        "plots": [
            "halpha_luminosity_vs_redshift.png",
            "halpha_hbeta_ratio_vs_redshift.png",
            "halpha_flux_histogram.png",
            "halpha_hbeta_ratio_histogram.png",
        ],
    }
    (args.output_dir / "halpha_diagnostics_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
