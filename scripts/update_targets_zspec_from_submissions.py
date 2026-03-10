#!/usr/bin/env python3
"""Update targets.csv z_spec using latest trusted redshift submissions."""

from __future__ import annotations

import argparse
import csv
import json
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


def load_latest_submissions(
    ndjson_path: Path, allow_bot: bool = True, allowed_conf: set[str] | None = None
) -> dict[str, float]:
    allowed_conf = allowed_conf or {"high", "medium"}
    latest: dict[str, tuple[datetime, float]] = {}
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
        conf = str(rec.get("confidence") or "").lower().strip()
        if conf and conf not in allowed_conf:
            continue
        reporter = str(rec.get("reporter_name") or "").lower().strip()
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
            latest[sid] = (ts, z)
    return {sid: z for sid, (_ts, z) in latest.items()}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets-csv", type=Path, default=Path("data/targets.csv"))
    ap.add_argument("--submissions-ndjson", type=Path, default=Path("data/redshift-submissions.ndjson"))
    ap.add_argument("--disallow-bot-submissions", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    latest = load_latest_submissions(
        args.submissions_ndjson, allow_bot=not args.disallow_bot_submissions, allowed_conf={"high", "medium"}
    )
    rows = []
    with args.targets_csv.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        for row in reader:
            rows.append(row)

    changed = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if not name.startswith("JADES-"):
            continue
        sid = name.split("-", 1)[1]
        if sid not in latest:
            continue
        z_new = latest[sid]
        old_text = (row.get("z_spec") or "").strip()
        try:
            z_old = float(old_text)
        except ValueError:
            z_old = None
        if z_old is not None and abs(z_old - z_new) < 1e-9:
            continue
        row["z_spec"] = f"{z_new:.3f}".rstrip("0").rstrip(".")
        changed.append((sid, old_text, row["z_spec"]))

    print(f"targets_rows={len(rows)}")
    print(f"updated_rows={len(changed)}")
    if changed:
        print("examples:")
        for sid, old, new in changed[:20]:
            print(f"  {sid}: {old or 'blank'} -> {new}")

    if args.dry_run:
        print("dry_run=true (no file written)")
        return 0

    with args.targets_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {args.targets_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
