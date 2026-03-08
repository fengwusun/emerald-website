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
    sid: str
    z_ref: float
    wave: list[float]
    flux: list[float]

@dataclass
class Match:
    sid: str
    z_ref: float
    z_est: float
    corr: float


def read_spec(path: Path):
    try:
        d = json.loads(path.read_text())
    except Exception:
        return None
    w = d.get('spectrum', {}).get('wavelength', [])
    f = d.get('spectrum', {}).get('flux', [])
    arr = []
    for a, b in zip(w, f):
        try:
            aa = float(a); bb = float(b)
        except Exception:
            continue
        if math.isfinite(aa) and math.isfinite(bb) and aa > 0:
            arr.append((aa, bb))
    if len(arr) < 25:
        return None
    arr.sort()
    return [x for x, _ in arr], [y for _, y in arr]


def median(vals):
    s = sorted(vals)
    n = len(s)
    return s[n // 2] if n % 2 else 0.5 * (s[n // 2 - 1] + s[n // 2])


def interp(x, y, q):
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


def runmean(v, h=7):
    c = [0.0]
    for x in v:
        c.append(c[-1] + x)
    n = len(v)
    out = []
    for i in range(n):
        lo = max(0, i - h); hi = min(n - 1, i + h)
        out.append((c[hi + 1] - c[lo]) / (hi - lo + 1))
    return out


def norm(v):
    hp = [a - b for a, b in zip(v, runmean(v, 7))]
    mu = sum(hp) / len(hp)
    hp = [x - mu for x in hp]
    var = sum(x * x for x in hp) / max(1, len(hp) - 1)
    s = math.sqrt(var) if var > 0 else 1.0
    return [x / s for x in hp]


def xcorr_near(a, b, lag_center, lag_hw, min_ov=40):
    n = len(a)
    best_c = -1e9
    best_lag = lag_center
    for lag in range(lag_center - lag_hw, lag_center + lag_hw + 1):
        if lag >= 0:
            i0, i1, j0 = 0, n - lag, lag
        else:
            i0, i1, j0 = -lag, n, 0
        m = i1 - i0
        if m < min_ov:
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


def detect_seeds(wave, flux, maxn=10):
    hp = [f - m for f, m in zip(flux, runmean(flux, 6))]
    abs_hp = sorted(abs(x) for x in hp)
    mad = abs_hp[len(abs_hp)//2] if abs_hp else 1e-6
    noise = max(1e-12, 1.4826 * mad)
    peaks = []
    for i in range(1, len(hp) - 1):
        if hp[i] > hp[i-1] and hp[i] >= hp[i+1]:
            sn = hp[i] / noise
            if sn > 2.5:
                peaks.append((sn, wave[i]))
    peaks.sort(reverse=True)
    peaks = peaks[:20]
    cand = []
    for sn, obs in peaks:
        for rest in STRONG_REST_LINES_UM:
            z = obs / rest - 1.0
            if 0 < z < 10:
                cand.append(round(z, 3))
    uniq = sorted(set(cand))
    scored = []
    for z in uniq:
        n = 0; w = 0.0
        for sn, obs in peaks:
            if min(abs(obs - rest * (1 + z)) for rest in STRONG_REST_LINES_UM) < 0.02:
                n += 1; w += sn
        if n >= 2:
            scored.append((w, n, z))
    scored.sort(reverse=True)
    return [z for _w, _n, z in scored[:maxn]]


def modes_from_matches(matches, seeds):
    pts = [(m.z_est, max(0.0, m.corr) ** 2) for m in matches if m.corr > 0 and m.z_est > 0]
    if not pts:
        return None, 0.0, 0.0, []
    modes = []
    for zc, _w in pts:
        wsum = 0.0; zsum = 0.0
        for z, w in pts:
            if abs(z - zc) <= 0.18:
                wsum += w; zsum += z * w
        if wsum > 0:
            modes.append((zsum / wsum, wsum))
    modes.sort(key=lambda x: x[1], reverse=True)
    uniq = []
    for z, w in modes:
        if not uniq or all(abs(z - z2) > 0.08 for z2, _ in uniq):
            uniq.append((z, w))
    if not uniq:
        return None, 0.0, 0.0, []
    # prefer seed-consistent mode if close in strength
    best_idx = 0
    if seeds:
        for i, (z, _w) in enumerate(uniq[:5]):
            if min(abs(z - s) for s in seeds) < 0.15:
                best_idx = i
                break
    zbest, wbest = uniq[best_idx]
    wtot = sum(w for _z, w in uniq[:8])
    frac = wbest / wtot if wtot > 0 else 0.0
    second = uniq[1][1] if len(uniq) > 1 else 0.0
    ratio = (wbest / second) if second > 0 else 9.9
    return zbest, frac, ratio, [{"z": z, "weight": w} for z, w in uniq[:8]]


def direct_template_score(tw, tf, zcand, templates, ngrid=120):
    # Direct rest-frame matching score (single-z objective, no lag mixing).
    rw_t = [w / (1.0 + zcand) for w in tw]
    vals = []
    for tmpl in templates:
        rw_r = [w / (1.0 + tmpl.z_ref) for w in tmpl.wave]
        lo = max(rw_t[0], rw_r[0], 0.35)
        hi = min(rw_t[-1], rw_r[-1], 3.35)
        if hi <= lo * 1.03:
            continue
        g = [lo + (hi - lo) * i / (ngrid - 1) for i in range(ngrid)]
        a = norm(interp(rw_t, tf, g))
        b = norm(interp(rw_r, tmpl.flux, g))
        sa = sb = sab = 0.0
        for av, bv in zip(a, b):
            sa += av * av
            sb += bv * bv
            sab += av * bv
        if sa > 0 and sb > 0:
            vals.append(sab / math.sqrt(sa * sb))
    if not vals:
        return -1e9
    vals.sort(reverse=True)
    k = min(10, len(vals))
    return sum(vals[:k]) / k


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--only-sid', type=str, default='')
    args = ap.parse_args()

    repo = Path('/Users/sunfengwu/Documents/emerald')
    targets_csv = repo / 'data' / 'targets.csv'
    sub_path = repo / 'data' / 'redshift-submissions.ndjson'
    spectrum_dir = Path('/Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026/diver_prism_plots')
    out_json = spectrum_dir / 'missing_redshift_scan_summary.json'

    # template set from submissions high/medium
    template_z = {}
    if sub_path.exists():
        for line in sub_path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            conf = str(d.get('confidence') or '').strip().lower()
            if conf and conf not in {'high', 'medium'}:
                continue
            sid = str(d.get('source_id') or '').strip()
            if not sid.isdigit():
                m = re.match(r'^JADES-(\d+)$', str(d.get('source_name') or '').strip())
                if not m:
                    continue
                sid = m.group(1)
            try:
                z = float(d.get('z_best'))
            except Exception:
                continue
            if z <= 0:
                continue
            if (spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json').exists():
                template_z[sid] = z

    # submitted valid set (exclude from scan)
    submitted = set(template_z.keys())

    # if too few templates, augment with proper catalog z
    if len(template_z) < 50:
        with targets_csv.open() as f:
            for r in csv.DictReader(f):
                m = re.match(r'^JADES-(\d+)$', (r.get('name') or '').strip())
                if not m:
                    continue
                sid = m.group(1)
                if sid in template_z:
                    continue
                try:
                    z = float((r.get('z_spec') or '').strip())
                except Exception:
                    continue
                if z > 0 and abs(z - 1.0) > 1e-9:
                    if (spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json').exists():
                        template_z[sid] = z

    # cache template spectra once
    templates = []
    for sid, z in template_z.items():
        sp = read_spec(spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json')
        if sp is None:
            continue
        w, f = sp
        templates.append(Spectrum(sid, z, w, f))

    # scan targets
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
            if (spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json').exists():
                scan.append(sid)
    if args.only_sid:
        scan = [s for s in scan if s == args.only_sid.strip()]

    results = []
    for i, sid in enumerate(scan, 1):
        sp = read_spec(spectrum_dir / f'jw_o002_{sid}_CLEAR_PRISM_x1d.json')
        if sp is None:
            results.append({"sid": sid, "label": "ambiguous", "status": "invalid_spectrum"})
            continue
        tw, tf = sp
        dln = median([math.log(tw[j+1]) - math.log(tw[j]) for j in range(len(tw)-1) if tw[j+1] > tw[j]])
        seeds = detect_seeds(tw, tf, maxn=10)

        matches = []
        for tmpl in templates:
            if tmpl.sid == sid:
                continue
            lo = max(tw[0], tmpl.wave[0])
            hi = min(tw[-1], tmpl.wave[-1])
            if hi <= lo * 1.04:
                continue
            n = int((math.log(hi) - math.log(lo)) / dln) + 1
            if n < 70:
                continue
            g = [math.exp(math.log(lo) + k * dln) for k in range(n)]
            a = norm(interp(tw, tf, g))
            b = norm(interp(tmpl.wave, tmpl.flux, g))

            best_corr = -1e9
            best_lag = 0
            if seeds:
                for z0 in seeds:
                    lag0 = int(round(math.log((1 + z0) / (1 + tmpl.z_ref)) / dln))
                    c, lag = xcorr_near(a, b, lag0, 9, min_ov=35)
                    if c > best_corr:
                        best_corr, best_lag = c, lag
            else:
                c, lag = xcorr_near(a, b, 0, max(6, int(0.25 * n)), min_ov=35)
                best_corr, best_lag = c, lag

            if not math.isfinite(best_corr):
                continue
            z_est = math.exp(best_lag * dln) * (1 + tmpl.z_ref) - 1
            if 0 < z_est < 10:
                matches.append(Match(tmpl.sid, tmpl.z_ref, z_est, best_corr))

        matches.sort(key=lambda m: m.corr, reverse=True)
        top = matches[:30]
        z_best, frac, ratio, modes = modes_from_matches(top, seeds)
        top_corr = top[0].corr if top else 0.0

        # Single best-z choice: maximize direct template score around line-seed candidates.
        z_best_single = z_best
        best_single_score = -1e9
        if seeds:
            for z0 in seeds[:4]:
                z = max(0.0, z0 - 0.05)
                while z <= min(10.0, z0 + 0.05) + 1e-12:
                    sdir = direct_template_score(tw, tf, z, templates, ngrid=120)
                    if sdir > best_single_score:
                        best_single_score = sdir
                        z_best_single = z
                    z += 0.004
        elif z_best is not None:
            z0 = z_best
            z = max(0.0, z0 - 0.08)
            while z <= min(10.0, z0 + 0.08) + 1e-12:
                sdir = direct_template_score(tw, tf, z, templates, ngrid=120)
                if sdir > best_single_score:
                    best_single_score = sdir
                    z_best_single = z
                z += 0.005

        if z_best_single is None or top_corr < 0.35:
            label = 'ambiguous'
        elif frac >= 0.50 and ratio >= 1.35 and top_corr >= 0.60 and best_single_score >= 0.50:
            label = 'high_confidence'
        elif frac >= 0.32 and ratio >= 1.10 and top_corr >= 0.45 and best_single_score >= 0.42:
            label = 'medium_confidence'
        else:
            label = 'ambiguous'

        results.append({
            'sid': sid,
            'z_auto': z_best_single,
            'z_mode': z_best,
            'direct_template_score': best_single_score,
            'label': label,
            'top_corr': top_corr,
            'mode_fraction': frac,
            'mode_ratio': ratio,
            'seed_candidates': seeds,
            'modes': modes,
            'top_matches': [
                {'template_sid': m.sid, 'z_template': m.z_ref, 'z_est': m.z_est, 'corr': m.corr}
                for m in top[:8]
            ],
        })

        if i % 25 == 0 or i == len(scan):
            print(f'progress {i}/{len(scan)}', flush=True)

    hc = [r for r in results if r.get('label') == 'high_confidence']
    mc = [r for r in results if r.get('label') == 'medium_confidence']
    am = [r for r in results if r.get('label') == 'ambiguous']

    payload = {
        'meta': {
            'scan_target_count': len(scan),
            'template_count': len(templates),
            'high_confidence_count': len(hc),
            'medium_confidence_count': len(mc),
            'ambiguous_count': len(am),
            'notes': 'No writes made to redshift-submissions.ndjson in this step.',
        },
        'examples': {
            'high_confidence': sorted(hc, key=lambda r: r.get('top_corr', 0.0), reverse=True)[:15],
            'ambiguous': sorted(am, key=lambda r: r.get('top_corr', 0.0), reverse=True)[:15],
        },
        'results': results,
    }

    out_json.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    print(f'scan_targets={len(scan)} templates={len(templates)}', flush=True)
    print(f'high={len(hc)} medium={len(mc)} ambiguous={len(am)}', flush=True)
    print(f'json={out_json}', flush=True)


if __name__ == '__main__':
    main()
