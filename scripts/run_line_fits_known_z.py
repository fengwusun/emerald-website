#!/usr/bin/env python3
"""Batch-run prism joint line fitting for sources with known redshift."""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def parse_ts(value: str) -> datetime:
    text = (value or "").strip()
    if not text:
        return datetime.min
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return datetime.min


def load_latest_submission_z(
    ndjson_path: Path, allow_bot: bool = True, min_conf: set[str] | None = None
) -> dict[str, tuple[float, str]]:
    latest: dict[str, tuple[datetime, float, str]] = {}
    min_conf = min_conf or {"high", "medium"}
    for raw in ndjson_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        sid = str(rec.get("source_id") or "").strip()
        if not sid.isdigit():
            continue
        conf = str(rec.get("confidence") or "").strip().lower()
        if conf and conf not in min_conf:
            continue
        reporter = str(rec.get("reporter_name") or "").strip().lower()
        if (not allow_bot) and reporter in {"bot", "xcorr-bot"}:
            continue
        try:
            z = float(rec.get("z_best"))
        except (TypeError, ValueError):
            continue
        if z <= 0:
            continue
        ts = parse_ts(str(rec.get("submitted_at") or ""))
        prev = latest.get(sid)
        if prev is None or ts >= prev[0]:
            latest[sid] = (ts, z, "submission")
    return {sid: (z, src) for sid, (_ts, z, src) in latest.items()}


def load_targets_z(targets_csv: Path) -> dict[str, tuple[float, str]]:
    out: dict[str, tuple[float, str]] = {}
    with targets_csv.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name = (row.get("name") or "").strip()
            if not name.startswith("JADES-"):
                continue
            sid = name.split("-", 1)[1]
            if not sid.isdigit():
                continue
            try:
                z = float((row.get("z_spec") or "").strip())
            except ValueError:
                continue
            if z > 0:
                out[sid] = (z, "targets")
    return out


def load_spec3_catalog_z(spec3_csv: Path) -> dict[str, tuple[float, str]]:
    out: dict[str, tuple[float, str]] = {}
    if not spec3_csv.exists():
        return out
    with spec3_csv.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            sid = str((row.get("id") or "").strip())
            # id format: o002_1030572
            if "_" in sid:
                sid = sid.split("_")[-1]
            if not sid.isdigit():
                continue
            try:
                z = float((row.get("Z") or "").strip())
            except ValueError:
                continue
            if z > 0:
                out[sid] = (z, "spec3_catalog")
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--media-dir", type=Path, required=True, help="Path to media root (emerald_msa_ptg-2026)")
    ap.add_argument(
        "--submissions-ndjson",
        type=Path,
        default=Path("data/redshift-submissions.ndjson"),
    )
    ap.add_argument("--targets-csv", type=Path, default=Path("data/targets.csv"))
    ap.add_argument("--spec3-catalog-csv", type=Path, default=None)
    ap.add_argument("--disallow-bot-submissions", action="store_true")
    ap.add_argument("--include-targets-zspec", action="store_true")
    ap.add_argument("--include-spec3-z", action="store_true", default=True)
    ap.add_argument("--only-sid", type=str, default=None)
    ap.add_argument("--max-sources", type=int, default=0)
    ap.add_argument("--ha-sii-mode", choices=["auto", "split", "single"], default="split")
    ap.add_argument("--pah33-rest-fwhm-um", type=float, default=0.06)
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--summary-json", type=Path, default=Path("/tmp/known_z_linefit_batch_summary.json"))
    args = ap.parse_args()

    prism_dir = args.media_dir / "diver_prism_plots"
    fit_script = Path(__file__).with_name("fit_prism_joint_lines.py")
    if not fit_script.exists():
        print(f"missing fit script: {fit_script}", file=sys.stderr)
        return 1

    zmap = load_latest_submission_z(
        args.submissions_ndjson, allow_bot=not args.disallow_bot_submissions, min_conf={"high", "medium"}
    )
    if args.include_targets_zspec:
        for sid, zv in load_targets_z(args.targets_csv).items():
            zmap.setdefault(sid, zv)
    if args.include_spec3_z:
        spec3_csv = args.spec3_catalog_csv
        if spec3_csv is None:
            spec3_csv = args.media_dir / "diver_prism_plots" / "spec3_catalog.csv"
        for sid, zv in load_spec3_catalog_z(spec3_csv).items():
            zmap.setdefault(sid, zv)

    if args.only_sid:
        if args.only_sid in zmap:
            zmap = {args.only_sid: zmap[args.only_sid]}
        else:
            print(f"sid {args.only_sid} not found in known-z inputs", file=sys.stderr)
            return 1

    sids = sorted(zmap.keys())
    if args.max_sources > 0:
        sids = sids[: args.max_sources]

    results = []
    status_counts = defaultdict(int)
    for sid in sids:
        z, zsrc = zmap[sid]
        spec_json = prism_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d.json"
        if not spec_json.exists():
            status_counts["missing_x1d"] += 1
            results.append({"sid": sid, "status": "missing_x1d", "z": z, "z_source": zsrc})
            continue
        out_json = prism_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d_joint_lsf_fit.json"
        out_png = prism_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d_joint_lsf_fit.png"
        if out_json.exists() and not args.overwrite:
            status_counts["skipped_exists"] += 1
            results.append({"sid": sid, "status": "skipped_exists", "z": z, "z_source": zsrc, "output_json": str(out_json)})
            continue

        cmd = [
            sys.executable,
            str(fit_script),
            "--spectrum-json",
            str(spec_json),
            "--z",
            str(z),
            "--ha-sii-mode",
            args.ha_sii_mode,
            "--pah33-rest-fwhm-um",
            str(args.pah33_rest_fwhm_um),
            "--output-json",
            str(out_json),
            "--output-plot",
            str(out_png),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            status_counts["failed"] += 1
            results.append(
                {
                    "sid": sid,
                    "status": "failed",
                    "z": z,
                    "z_source": zsrc,
                    "stderr": proc.stderr[-2000:],
                    "stdout": proc.stdout[-2000:],
                }
            )
            continue
        status_counts["ok"] += 1
        results.append(
            {
                "sid": sid,
                "status": "ok",
                "z": z,
                "z_source": zsrc,
                "output_json": str(out_json),
                "output_plot": str(out_png),
            }
        )

    summary = {
        "media_dir": str(args.media_dir),
        "count_input": len(sids),
        "status_counts": dict(status_counts),
        "ha_sii_mode": args.ha_sii_mode,
        "pah33_rest_fwhm_um": args.pah33_rest_fwhm_um,
        "results": results,
    }
    args.summary_json.parent.mkdir(parents=True, exist_ok=True)
    args.summary_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"summary_json {args.summary_json}")
    print(f"status_counts {dict(status_counts)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
