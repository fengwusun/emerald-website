#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

STRONG_REST_LINES_UM = [
    0.372850, 0.386876, 0.410289, 0.434168, 0.486267, 0.4960295, 0.500824,
    0.656461, 0.658527, 0.907110, 0.953321, 1.005210, 1.083330, 1.094100,
    1.257020, 1.282150, 1.644050, 1.875600, 2.059250, 2.122380, 2.166100,
    2.625840, 3.290000,
]


@dataclass
class Spectrum:
    wave: list[float]
    flux: list[float]


@dataclass
class Match:
    sid: str
    z_ref: float
    z_est: float
    corr: float


def read_spec(path: Path) -> Spectrum | None:
    try:
        d = json.loads(path.read_text())
    except Exception:
        return None
    w = d.get("spectrum", {}).get("wavelength", [])
    f = d.get("spectrum", {}).get("flux", [])
    n = min(len(w), len(f))
    arr = []
    for i in range(n):
        try:
            wi = float(w[i]); fi = float(f[i])
        except Exception:
            continue
        if math.isfinite(wi) and math.isfinite(fi) and wi > 0:
            arr.append((wi, fi))
    if len(arr) < 25:
        return None
    arr.sort()
    return Spectrum([a for a, _ in arr], [b for _, b in arr])


def median(v: list[float]) -> float:
    s = sorted(v)
    n = len(s)
    return s[n // 2] if n % 2 else 0.5 * (s[n // 2 - 1] + s[n // 2])


def interp_linear(x: list[float], y: list[float], q: list[float]) -> list[float]:
    out = []
    j = 0
    n = len(x)
    for qq in q:
        while j + 1 < n and x[j + 1] < qq:
            j += 1
        if j + 1 >= n:
            out.append(y[-1]); continue
        x0, x1 = x[j], x[j + 1]
        y0, y1 = y[j], y[j + 1]
        t = 0.0 if x1 == x0 else (qq - x0) / (x1 - x0)
        out.append(y0 * (1 - t) + y1 * t)
    return out


def running_mean(v: list[float], half: int) -> list[float]:
    c = [0.0]
    for x in v:
        c.append(c[-1] + x)
    out = []
    n = len(v)
    for i in range(n):
        lo = max(0, i - half)
        hi = min(n - 1, i + half)
        out.append((c[hi + 1] - c[lo]) / (hi - lo + 1))
    return out


def norm_feature(v: list[float]) -> list[float]:
    hp = [a - b for a, b in zip(v, running_mean(v, 7))]
    mu = sum(hp) / len(hp)
    hp = [x - mu for x in hp]
    var = sum(x * x for x in hp) / max(1, len(hp) - 1)
    s = math.sqrt(var) if var > 0 else 1.0
    return [x / s for x in hp]


def xcorr_best(a: list[float], b: list[float], max_lag: int, min_overlap: int = 45) -> tuple[float, int]:
    n = len(a)
    best_c = -1e9
    best_lag = 0
    for lag in range(-max_lag, max_lag + 1):
        if lag >= 0:
            i0, i1, j0 = 0, n - lag, lag
        else:
            i0, i1, j0 = -lag, n, 0
        m = i1 - i0
        if m < min_overlap:
            continue
        sa = sb = sab = 0.0
        for k in range(m):
            av = a[i0 + k]; bv = b[j0 + k]
            sa += av * av; sb += bv * bv; sab += av * bv
        if sa <= 0 or sb <= 0:
            continue
        c = sab / math.sqrt(sa * sb)
        if c > best_c:
            best_c, best_lag = c, lag
    return best_c, best_lag


def detect_seed_z(spec: Spectrum, max_seeds: int = 8) -> list[float]:
    hp = [f - m for f, m in zip(spec.flux, running_mean(spec.flux, 6))]
    abs_hp = sorted(abs(x) for x in hp)
    mad = abs_hp[len(abs_hp) // 2] if abs_hp else 1e-6
    noise = max(1e-12, 1.4826 * mad)
    peaks = []
    for i in range(1, len(hp) - 1):
        if hp[i] > hp[i - 1] and hp[i] >= hp[i + 1]:
            s = hp[i] / noise
            if s > 2.5:
                peaks.append((s, spec.wave[i]))
    peaks.sort(reverse=True)
    peaks = peaks[:20]

    cand = []
    for sn, w in peaks:
        for rest in STRONG_REST_LINES_UM:
            z = w / rest - 1
            if 0 < z < 10:
                cand.append(round(z, 3))
    uniq = sorted(set(cand))
    scored = []
    for z in uniq:
        n = 0
        wsum = 0.0
        for sn, obs in peaks:
            if min(abs(obs - rest * (1 + z)) for rest in STRONG_REST_LINES_UM) < 0.02:
                n += 1
                wsum += sn
        if n >= 2:
            scored.append((wsum, n, z))
    scored.sort(reverse=True)
    return [z for _w, _n, z in scored[:max_seeds]]


def cluster_modes(matches: list[Match], seed_z: list[float]) -> tuple[float | None, float, float, list[dict]]:
    if not matches:
        return None, 0.0, 99.0, []
    pts = [(m.z_est, max(0.0, m.corr) ** 2) for m in matches if m.z_est > 0 and m.corr > 0]
    if not pts:
        return None, 0.0, 99.0, []

    modes = []
    for zc, _w0 in pts:
        wsum = 0.0
        zsum = 0.0
        for z, w in pts:
            if abs(z - zc) <= 0.18:
                wsum += w
                zsum += z * w
        if wsum > 0:
            modes.append((zsum / wsum, wsum))
    modes.sort(key=lambda x: x[1], reverse=True)

    # dedup nearby
    uniq = []
    for z, w in modes:
        if not uniq or all(abs(z - z2) > 0.08 for z2, _ in uniq):
            uniq.append((z, w))
    if not uniq:
        return None, 0.0, 99.0, []

    # seed-prior pick when available
    best_i = 0
    if seed_z:
        for i, (z, _w) in enumerate(uniq[:5]):
            if min(abs(z - s) for s in seed_z) < 0.15:
                best_i = i
                break

    z_best, w_best = uniq[best_i]
    w_total = sum(w for _z, w in uniq[:8])
    frac = w_best / w_total if w_total > 0 else 0.0
    second = uniq[1][1] if len(uniq) > 1 else 0.0
    ratio = (w_best / second) if second > 0 else 9.9
    modes_out = [{"z": z, "weight": w} for z, w in uniq[:8]]
    return z_best, frac, ratio, modes_out


def load_template_set_from_submissions(sub_path: Path, spectrum_dir: Path) -> dict[str, float]:
    out = {}
    if not sub_path.exists():
        return out
    for line in sub_path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except Exception:
            continue
        conf = str(d.get("confidence") or "").strip().lower()
        if conf and conf not in {"high", "medium"}:
            continue
        sid = str(d.get("source_id") or "").strip()
        if not sid.isdigit():
            m = re.match(r"^JADES-(\d+)$", str(d.get("source_name") or "").strip())
            if not m:
                continue
            sid = m.group(1)
        try:
            z = float(d.get("z_best"))
        except Exception:
            continue
        if z <= 0:
            continue
        sp = spectrum_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d.json"
        if sp.exists():
            out[sid] = z
    return out


def main() -> int:
    repo = Path('/Users/sunfengwu/Documents/emerald')
    targets_csv = repo / 'data' / 'targets.csv'
    sub_path = repo / 'data' / 'redshift-submissions.ndjson'
    spectrum_dir = Path('/Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026/diver_prism_plots')
    out_json = spectrum_dir / 'missing_redshift_scan_summary.json'

    # templates: use existing submissions (human-confirmed) first
    templates = load_template_set_from_submissions(sub_path, spectrum_dir)

    # fallback add proper catalog-z templates if too few
    if len(templates) < 40:
        with targets_csv.open() as f:
            for r in csv.DictReader(f):
                m = re.match(r'^JADES-(\d+)$', (r.get('name') or '').strip())
                if not m:
                    continue
                sid = m.group(1)
                if sid in templates:
                    continue
                try:
                    z = float((r.get('z_spec') or '').strip())
                except Exception:
                    continue
                if z > 0 and abs(z - 1.0) > 1e-9:
                    sp = spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json'
                    if sp.exists():
                        templates[sid] = z

    # scan targets: missing in catalog and no valid submission yet
    submitted = set(load_template_set_from_submissions(sub_path, spectrum_dir).keys())
    scan = []
    with targets_csv.open() as f:
        for r in csv.DictReader(f):
            m = re.match(r'^JADES-(\d+)$', (r.get('name') or '').strip())
            if not m:
                continue
            sid = m.group(1)
            try:
                z = float((r.get('z_spec') or '').strip())
            except Exception:
                z = None
            missing = (z is None) or (z <= 0) or (abs(z - 1.0) < 1e-9)
            if not missing:
                continue
            if sid in submitted:
                continue
            sp = spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json'
            if sp.exists():
                scan.append(sid)

    # cache template normalized vectors per target grid on-the-fly per pairing (simple path)
    results = []
    for i, sid in enumerate(scan, 1):
        target = read_spec(spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json')
        if target is None:
            results.append({"sid": sid, "status": "invalid_spectrum"})
            continue

        dln_t = [math.log(target.wave[j + 1]) - math.log(target.wave[j]) for j in range(len(target.wave) - 1) if target.wave[j + 1] > target.wave[j]]
        if len(dln_t) < 10:
            results.append({"sid": sid, "status": "bad_sampling"})
            continue
        dln = median(dln_t)

        matches = []
        for tsid, zref in templates.items():
            if tsid == sid:
                continue
            tmpl = read_spec(spectrum_dir / f'jw_o002_{tsid}_CLEAR_PRISM_x1d.json')
            if tmpl is None:
                continue
            lo = max(target.wave[0], tmpl.wave[0])
            hi = min(target.wave[-1], tmpl.wave[-1])
            if hi <= lo * 1.04:
                continue
            n = int((math.log(hi) - math.log(lo)) / dln) + 1
            if n < 80:
                continue
            g = [math.exp(math.log(lo) + k * dln) for k in range(n)]
            a = norm_feature(interp_linear(target.wave, target.flux, g))
            b = norm_feature(interp_linear(tmpl.wave, tmpl.flux, g))
            corr, lag = xcorr_best(a, b, max_lag=max(6, int(0.35 * n)), min_overlap=45)
            if not math.isfinite(corr):
                continue
            z_est = math.exp(lag * dln) * (1 + zref) - 1
            if 0 < z_est < 10:
                matches.append(Match(tsid, zref, z_est, corr))

        matches.sort(key=lambda m: m.corr, reverse=True)
        top = matches[:25]
        seed = detect_seed_z(target, max_seeds=8)
        z_best, frac, ratio, modes = cluster_modes(top, seed)
        top_corr = top[0].corr if top else 0.0

        if z_best is None or top_corr < 0.35:
            label = 'ambiguous'
        elif frac >= 0.45 and ratio >= 1.30 and top_corr >= 0.55:
            label = 'high_confidence'
        elif frac >= 0.30 and ratio >= 1.10 and top_corr >= 0.45:
            label = 'medium_confidence'
        else:
            label = 'ambiguous'

        results.append({
            "sid": sid,
            "z_auto": z_best,
            "label": label,
            "top_corr": top_corr,
            "mode_fraction": frac,
            "mode_ratio": ratio,
            "seed_candidates": seed,
            "modes": modes,
            "top_matches": [
                {"template_sid": m.sid, "z_template": m.z_ref, "z_est": m.z_est, "corr": m.corr}
                for m in top[:8]
            ],
        })

        if i % 25 == 0 or i == len(scan):
            print(f'progress {i}/{len(scan)}')

    hc = [r for r in results if r.get('label') == 'high_confidence']
    mc = [r for r in results if r.get('label') == 'medium_confidence']
    am = [r for r in results if r.get('label') == 'ambiguous']

    payload = {
        "meta": {
            "scan_target_count": len(scan),
            "template_count": len(templates),
            "high_confidence_count": len(hc),
            "medium_confidence_count": len(mc),
            "ambiguous_count": len(am),
            "notes": "No writes made to redshift-submissions.ndjson in this step.",
        },
        "examples": {
            "high_confidence": sorted(hc, key=lambda r: r.get('top_corr', 0.0), reverse=True)[:12],
            "ambiguous": sorted(am, key=lambda r: r.get('top_corr', 0.0), reverse=True)[:12],
        },
        "results": results,
    }

    out_json.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(f'scan_targets={len(scan)} templates={len(templates)}')
    print(f'high={len(hc)} medium={len(mc)} ambiguous={len(am)}')
    print(f'json={out_json}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
