#!/usr/bin/env python3
"""Estimate redshift from prism x1d spectra via template cross-correlation.

Method:
- Use sources with proper z_spec (z>0 and z!=1) as templates.
- For each template, cross-correlate observed-frame spectra on a uniform log-lambda grid.
- Convert best lag to target redshift using:
    (1+z_target) = exp(lag * dln_lambda) * (1+z_template)
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

STRONG_REST_LINES_UM = [
    0.372850,   # [OII]
    0.386876,   # [NeIII]
    0.410289,   # Hdelta
    0.434168,   # Hgamma
    0.486267,   # Hbeta
    0.4960295,  # [OIII]4960
    0.500824,   # [OIII]5008
    0.656461,   # Halpha
    0.658527,   # [NII]
    0.907110,   # [SIII]9071
    0.953321,   # [SIII]9533
    1.005210,   # Paδ
    1.083330,   # HeI 10833
    1.094100,   # Paγ
    1.257020,   # [FeII] 12570
    1.282150,   # Paβ
    1.644050,   # [FeII] 16440
    1.875600,   # Paα
    2.059250,   # HeI 20592
    2.122380,   # H2
    2.166100,   # Brγ
    2.625840,   # Brβ
    3.290000,   # PAH 3.3
]

@dataclass
class Spectrum:
    wave_um: list[float]
    flux: list[float]


@dataclass
class MatchResult:
    template_sid: str
    z_template: float
    z_est: float
    corr: float
    lag: int
    n_points: int


def read_spectrum_json(path: Path) -> Spectrum | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    w = payload.get("spectrum", {}).get("wavelength", [])
    f = payload.get("spectrum", {}).get("flux", [])
    n = min(len(w), len(f))
    wave = []
    flux = []
    for i in range(n):
        try:
            wi = float(w[i])
            fi = float(f[i])
        except Exception:
            continue
        if not (math.isfinite(wi) and math.isfinite(fi) and wi > 0):
            continue
        wave.append(wi)
        flux.append(fi)
    if len(wave) < 20:
        return None
    order = sorted(range(len(wave)), key=lambda i: wave[i])
    return Spectrum([wave[i] for i in order], [flux[i] for i in order])


def median(values: list[float]) -> float:
    if not values:
        return float("nan")
    s = sorted(values)
    m = len(s) // 2
    return s[m] if len(s) % 2 else 0.5 * (s[m - 1] + s[m])


def interp_linear(x: list[float], y: list[float], xq: list[float]) -> list[float]:
    out = []
    j = 0
    n = len(x)
    for q in xq:
        while j + 1 < n and x[j + 1] < q:
            j += 1
        if j + 1 >= n:
            out.append(y[-1])
            continue
        x0, x1 = x[j], x[j + 1]
        y0, y1 = y[j], y[j + 1]
        if x1 == x0:
            out.append(y0)
        else:
            t = (q - x0) / (x1 - x0)
            out.append(y0 * (1 - t) + y1 * t)
    return out


def running_mean(values: list[float], half_window: int) -> list[float]:
    n = len(values)
    out = [0.0] * n
    csum = [0.0]
    for v in values:
        csum.append(csum[-1] + v)
    for i in range(n):
        lo = max(0, i - half_window)
        hi = min(n - 1, i + half_window)
        s = csum[hi + 1] - csum[lo]
        out[i] = s / (hi - lo + 1)
    return out


def normalize_feature(values: list[float]) -> list[float]:
    cont = running_mean(values, half_window=8)
    hp = [v - c for v, c in zip(values, cont)]
    mu = sum(hp) / len(hp)
    var = sum((v - mu) * (v - mu) for v in hp) / max(1, len(hp) - 1)
    sig = math.sqrt(var) if var > 0 else 1.0
    return [(v - mu) / sig for v in hp]


def detect_peak_seed_redshifts(wave: list[float], flux: list[float], max_seeds: int = 12) -> list[float]:
    """Generate redshift seeds from high-pass peaks matched to common strong lines."""
    if len(wave) < 10:
        return []

    # Crude local high-pass
    cont = running_mean(flux, half_window=6)
    hp = [f - c for f, c in zip(flux, cont)]

    # Robust noise scale
    abs_hp = sorted(abs(v) for v in hp)
    med_abs = abs_hp[len(abs_hp) // 2] if abs_hp else 1.0
    noise = max(med_abs * 1.4826, 1e-12)

    peaks: list[tuple[float, float]] = []  # (snr_like, wave_um)
    for i in range(1, len(hp) - 1):
        if hp[i] > hp[i - 1] and hp[i] >= hp[i + 1]:
            s = hp[i] / noise
            if s > 2.5:
                peaks.append((s, wave[i]))
    peaks.sort(reverse=True)
    peaks = peaks[:20]

    # Candidate z from peak/line pairing
    cand: list[float] = []
    for snr, w in peaks:
        for rest in STRONG_REST_LINES_UM:
            z = w / rest - 1.0
            if 0.0 < z < 10.0:
                cand.append(round(z, 3))
    if not cand:
        return []

    # Score each candidate by how many peaks align to any strong line
    uniq = sorted(set(cand))
    scored: list[tuple[float, int, float]] = []
    for z in uniq:
        n_match = 0
        weight = 0.0
        for snr, w in peaks:
            best = min(abs(w - rest * (1.0 + z)) for rest in STRONG_REST_LINES_UM)
            if best < 0.02:  # 0.02 um tolerance for prism-like resolution
                n_match += 1
                weight += snr
        if n_match >= 2:
            scored.append((weight, n_match, z))
    scored.sort(reverse=True)
    return [z for _w, _n, z in scored[:max_seeds]]


def cross_corr_best(a: list[float], b: list[float], max_lag: int, min_overlap: int = 40) -> tuple[float, int, int]:
    n = len(a)
    best_c = -1e9
    best_lag = 0
    best_n = 0
    for lag in range(-max_lag, max_lag + 1):
        if lag >= 0:
            i0, i1 = 0, n - lag
            j0 = lag
        else:
            i0, i1 = -lag, n
            j0 = 0
        m = i1 - i0
        if m < min_overlap:
            continue

        sa2 = 0.0
        sb2 = 0.0
        sab = 0.0
        for k in range(m):
            av = a[i0 + k]
            bv = b[j0 + k]
            sab += av * bv
            sa2 += av * av
            sb2 += bv * bv
        if sa2 <= 0 or sb2 <= 0:
            continue
        c = sab / math.sqrt(sa2 * sb2)
        if c > best_c:
            best_c = c
            best_lag = lag
            best_n = m
    return best_c, best_lag, best_n


def cross_corr_near_lag(
    a: list[float], b: list[float], lag_center: int, lag_half_window: int, min_overlap: int = 40
) -> tuple[float, int, int]:
    n = len(a)
    best_c = -1e9
    best_lag = lag_center
    best_n = 0
    for lag in range(lag_center - lag_half_window, lag_center + lag_half_window + 1):
        if lag >= 0:
            i0, i1 = 0, n - lag
            j0 = lag
        else:
            i0, i1 = -lag, n
            j0 = 0
        m = i1 - i0
        if m < min_overlap:
            continue
        sa2 = 0.0
        sb2 = 0.0
        sab = 0.0
        for k in range(m):
            av = a[i0 + k]
            bv = b[j0 + k]
            sab += av * bv
            sa2 += av * av
            sb2 += bv * bv
        if sa2 <= 0 or sb2 <= 0:
            continue
        c = sab / math.sqrt(sa2 * sb2)
        if c > best_c:
            best_c = c
            best_lag = lag
            best_n = m
    return best_c, best_lag, best_n


def build_template_table(targets_csv: Path, spectrum_dir: Path) -> dict[str, float]:
    out: dict[str, float] = {}
    with targets_csv.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            m = re.match(r"^JADES-(\d+)$", name)
            if not m:
                continue
            sid = m.group(1)
            try:
                z = float((row.get("z_spec") or "").strip())
            except Exception:
                continue
            if z <= 0 or abs(z - 1.0) < 1e-9:
                continue
            sp = spectrum_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d.json"
            if sp.exists():
                out[sid] = z
    return out


def estimate_for_target(
    target_sid: str,
    target_spec_path: Path,
    template_z: dict[str, float],
    spectrum_dir: Path,
    top_n: int,
) -> tuple[list[MatchResult], float | None, float | None, list[float], float | None]:
    target = read_spectrum_json(target_spec_path)
    if target is None:
        return [], None, None, [], None

    dln_t = [math.log(target.wave_um[i + 1]) - math.log(target.wave_um[i]) for i in range(len(target.wave_um) - 1)]
    dln_t = [x for x in dln_t if x > 0 and math.isfinite(x)]
    dln_target = median(dln_t)
    if not math.isfinite(dln_target) or dln_target <= 0:
        return [], None, None, [], None

    seed_z = detect_peak_seed_redshifts(target.wave_um, target.flux, max_seeds=12)

    results: list[MatchResult] = []
    seed_hits: dict[float, list[tuple[float, float]]] = {z0: [] for z0 in seed_z}  # z_seed -> [(z_est, corr)]

    for sid, zref in template_z.items():
        if sid == target_sid:
            continue
        spec_path = spectrum_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d.json"
        tmpl = read_spectrum_json(spec_path)
        if tmpl is None:
            continue

        lo = max(target.wave_um[0], tmpl.wave_um[0])
        hi = min(target.wave_um[-1], tmpl.wave_um[-1])
        if hi <= lo * 1.05:
            continue

        l0 = math.log(lo)
        l1 = math.log(hi)
        ngrid = int((l1 - l0) / dln_target) + 1
        if ngrid < 80:
            continue
        ln_grid = [l0 + i * dln_target for i in range(ngrid)]
        grid = [math.exp(x) for x in ln_grid]

        ft = interp_linear(target.wave_um, target.flux, grid)
        fr = interp_linear(tmpl.wave_um, tmpl.flux, grid)

        a = normalize_feature(ft)
        b = normalize_feature(fr)

        max_lag = max(6, int(0.35 * ngrid))
        corr, lag, npts = cross_corr_best(a, b, max_lag=max_lag, min_overlap=50)
        if not math.isfinite(corr):
            continue

        z_est = math.exp(lag * dln_target) * (1.0 + zref) - 1.0
        if z_est < -0.1 or z_est > 15:
            continue

        results.append(MatchResult(sid, zref, z_est, corr, lag, npts))

        # Constrained local-lag correlations around each line-seed candidate.
        for z0 in seed_z:
            if z0 <= 0:
                continue
            lag0 = int(round(math.log((1.0 + z0) / (1.0 + zref)) / dln_target))
            corr2, lag2, npts2 = cross_corr_near_lag(a, b, lag_center=lag0, lag_half_window=10, min_overlap=45)
            if not math.isfinite(corr2):
                continue
            z2 = math.exp(lag2 * dln_target) * (1.0 + zref) - 1.0
            if z2 <= 0 or z2 > 15:
                continue
            seed_hits[z0].append((z2, corr2))

    results.sort(key=lambda r: r.corr, reverse=True)
    results_all = results[:]
    results = results[:top_n]

    good = [r for r in results if r.corr > 0.25 and r.z_est > 0]
    if not good:
        return results, None, None, seed_z, None

    weights = [max(0.0, r.corr) ** 2 for r in good]
    sw = sum(weights)
    z_mean = sum(w * r.z_est for w, r in zip(weights, good)) / sw if sw > 0 else None
    if z_mean is None:
        return results, None, None, seed_z, None
    z_var = sum(w * (r.z_est - z_mean) ** 2 for w, r in zip(weights, good)) / sw if sw > 0 else None
    z_std = math.sqrt(z_var) if (z_var is not None and z_var >= 0) else None

    # Seeded consensus from constrained local-lag correlations.
    z_seeded_best: float | None = None
    if seed_z:
        best_seed_score = -1.0
        best_seed = None
        for z0 in seed_z:
            pts = seed_hits.get(z0, [])
            if not pts:
                continue
            s = sum(max(0.0, c) ** 2 for _z, c in pts)
            if s > best_seed_score:
                best_seed_score = s
                best_seed = z0

        if best_seed is not None:
            near = [(z, c) for z, c in seed_hits.get(best_seed, []) if c > 0 and abs(z - best_seed) <= 0.25]
            if near:
                w = [c * c for _z, c in near]
                sw2 = sum(w)
                if sw2 > 0:
                    z_seeded_best = sum(wi * zi for wi, (zi, _ci) in zip(w, near)) / sw2

    return results, z_mean, z_std, seed_z, z_seeded_best


def build_template_rest_grid(
    template_z: dict[str, float], spectrum_dir: Path, rest_grid: list[float]
) -> list[tuple[str, float, list[float | None]]]:
    out: list[tuple[str, float, list[float | None]]] = []
    for sid, zref in template_z.items():
        sp = read_spectrum_json(spectrum_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d.json")
        if sp is None:
            continue
        rw = [w / (1.0 + zref) for w in sp.wave_um]
        lo = max(rest_grid[0], rw[0])
        hi = min(rest_grid[-1], rw[-1])
        vec: list[float | None] = [None] * len(rest_grid)
        if hi <= lo * 1.02:
            out.append((sid, zref, vec))
            continue
        idx = [i for i, g in enumerate(rest_grid) if lo <= g <= hi]
        if len(idx) < 60:
            out.append((sid, zref, vec))
            continue
        g = [rest_grid[i] for i in idx]
        fv = interp_linear(rw, sp.flux, g)
        nv = normalize_feature(fv)
        for i, v in zip(idx, nv):
            vec[i] = v
        out.append((sid, zref, vec))
    return out


def target_rest_on_grid(target: Spectrum, z: float, rest_grid: list[float]) -> list[float | None]:
    rw = [w / (1.0 + z) for w in target.wave_um]
    lo = max(rest_grid[0], rw[0])
    hi = min(rest_grid[-1], rw[-1])
    vec: list[float | None] = [None] * len(rest_grid)
    if hi <= lo * 1.02:
        return vec
    idx = [i for i, g in enumerate(rest_grid) if lo <= g <= hi]
    if len(idx) < 60:
        return vec
    g = [rest_grid[i] for i in idx]
    fv = interp_linear(rw, target.flux, g)
    nv = normalize_feature(fv)
    for i, v in zip(idx, nv):
        vec[i] = v
    return vec


def masked_corr(a: list[float | None], b: list[float | None], min_points: int = 50) -> float:
    sab = 0.0
    sa2 = 0.0
    sb2 = 0.0
    n = 0
    for av, bv in zip(a, b):
        if av is None or bv is None:
            continue
        sab += av * bv
        sa2 += av * av
        sb2 += bv * bv
        n += 1
    if n < min_points or sa2 <= 0 or sb2 <= 0:
        return float("nan")
    return sab / math.sqrt(sa2 * sb2)


def score_z_against_templates(
    target_vec: list[float | None], templates_rest: list[tuple[str, float, list[float | None]]], top_k: int = 12
) -> tuple[float, list[tuple[str, float]]]:
    vals: list[tuple[str, float]] = []
    for sid, _zr, tvec in templates_rest:
        c = masked_corr(target_vec, tvec, min_points=50)
        if math.isfinite(c):
            vals.append((sid, c))
    if not vals:
        return float("nan"), []
    vals.sort(key=lambda x: x[1], reverse=True)
    k = min(top_k, len(vals))
    score = sum(v for _sid, v in vals[:k]) / k
    return score, vals[:k]


def find_local_maxima(samples: list[tuple[float, float]]) -> list[tuple[float, float]]:
    # samples: [(z, score)] sorted by z
    out = []
    for i in range(1, len(samples) - 1):
        z0, s0 = samples[i]
        _zl, sl = samples[i - 1]
        _zr, sr = samples[i + 1]
        if s0 >= sl and s0 >= sr:
            out.append((z0, s0))
    out.sort(key=lambda x: x[1], reverse=True)
    return out


def grid_search_redshift(
    target: Spectrum,
    templates_rest: list[tuple[str, float, list[float | None]]],
    rest_grid: list[float],
) -> tuple[float | None, list[tuple[float, float]], list[tuple[float, float]]]:
    # Coarse pass: z=0..10 step 0.01
    coarse: list[tuple[float, float]] = []
    z = 0.0
    while z <= 10.0001:
        tvec = target_rest_on_grid(target, z, rest_grid)
        score, _top = score_z_against_templates(tvec, templates_rest, top_k=12)
        coarse.append((round(z, 4), score if math.isfinite(score) else -1e9))
        z += 0.01

    coarse_peaks = find_local_maxima(coarse)[:8]
    if not coarse_peaks:
        return None, coarse[:], []

    # Fine pass around top coarse peaks: +/-0.06 with step 0.001
    fine: list[tuple[float, float]] = []
    for zc, _sc in coarse_peaks[:5]:
        z0 = max(0.0, zc - 0.06)
        z1 = min(10.0, zc + 0.06)
        zf = z0
        while zf <= z1 + 1e-12:
            tvec = target_rest_on_grid(target, zf, rest_grid)
            score, _top = score_z_against_templates(tvec, templates_rest, top_k=12)
            fine.append((round(zf, 5), score if math.isfinite(score) else -1e9))
            zf += 0.001

    # Deduplicate fine samples by z
    dedup: dict[float, float] = {}
    for zz, ss in fine:
        if zz not in dedup or ss > dedup[zz]:
            dedup[zz] = ss
    fine_sorted = sorted(dedup.items(), key=lambda x: x[0])
    fine_peaks = find_local_maxima(fine_sorted)
    z_best = fine_peaks[0][0] if fine_peaks else coarse_peaks[0][0]
    return z_best, coarse_peaks, fine_peaks[:10]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-sid", required=True, help="Source ID digits, e.g. 1066521")
    ap.add_argument(
        "--targets-csv",
        type=Path,
        default=Path("/Users/sunfengwu/Documents/emerald/data/targets.csv"),
    )
    ap.add_argument(
        "--spectrum-dir",
        type=Path,
        default=Path("/Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026/diver_prism_plots"),
    )
    ap.add_argument("--top-n", type=int, default=25)
    ap.add_argument("--output-json", type=Path, default=None)
    args = ap.parse_args()

    sid = args.target_sid.strip()
    target_spec_path = args.spectrum_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d.json"
    if not target_spec_path.exists():
        raise SystemExit(f"missing target spectrum: {target_spec_path}")

    tmpl = build_template_table(args.targets_csv, args.spectrum_dir)
    target_spec = read_spectrum_json(target_spec_path)
    if target_spec is None:
        raise SystemExit(f"invalid target spectrum: {target_spec_path}")
    matches, z_best, z_std, seed_z, z_seeded_best = estimate_for_target(
        target_sid=sid,
        target_spec_path=target_spec_path,
        template_z=tmpl,
        spectrum_dir=args.spectrum_dir,
        top_n=max(args.top_n, 120),
    )

    # User-requested two-stage grid scan.
    # Include optical + NIR diagnostics up to PAH 3.3um.
    rest_grid = [0.35 + i * 0.003 for i in range(int((3.35 - 0.35) / 0.003) + 1)]
    templates_rest = build_template_rest_grid(tmpl, args.spectrum_dir, rest_grid)
    z_grid_best, coarse_peaks, fine_peaks = grid_search_redshift(target_spec, templates_rest, rest_grid)

    payload = {
        "target_sid": sid,
        "target_spectrum": str(target_spec_path),
        "template_count": len(tmpl),
        "method": "log-lambda cross-correlation vs proper-z prism templates",
        "z_best_weighted": z_best,
        "z_best_seeded_consensus": z_seeded_best,
        "z_best_gridscan": z_grid_best,
        "z_scatter_weighted": z_std,
        "line_peak_seed_candidates": seed_z,
        "gridscan_coarse_peaks": [{"z": zc, "score": sc} for zc, sc in coarse_peaks],
        "gridscan_fine_peaks": [{"z": zc, "score": sc} for zc, sc in fine_peaks],
        "matches": [
            {
                "template_sid": m.template_sid,
                "z_template": m.z_template,
                "z_est": m.z_est,
                "corr": m.corr,
                "lag": m.lag,
                "n_overlap": m.n_points,
            }
            for m in matches
        ],
    }

    if args.output_json is None:
        args.output_json = args.spectrum_dir / f"jw_o002_{sid}_CLEAR_PRISM_x1d_redshift_xcorr.json"

    args.output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"target={sid}")
    print(f"templates={len(tmpl)}")
    print(f"z_best_weighted={z_best}")
    print(f"z_best_seeded_consensus={z_seeded_best}")
    print(f"z_best_gridscan={z_grid_best}")
    print(f"z_scatter_weighted={z_std}")
    print(f"line_peak_seed_candidates={seed_z[:8]}")
    print("top_matches:")
    for m in matches[:10]:
        print(
            f"  sid={m.template_sid} z_est={m.z_est:.4f} corr={m.corr:.3f} "
            f"(z_ref={m.z_template:.4f}, n={m.n_points})"
        )
    print(f"json={args.output_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
