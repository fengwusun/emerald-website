#!/usr/bin/env python3
"""Joint PRISM emission-line fitting with trained constraints.

Key behavior:
- Joint local-window fits with PRISM LSF-convolved Gaussian templates
- Fixed [OIII] 5008/4960 and [SIII] 9533/9071 ratios
- Report complex-only flux when a doublet is unresolved
- Halpha+[NII] treated as one complex; include [SII] only when unresolved
- Forbidden-line non-negativity
- Break-aware local continuum terms near LyA/Balmer regions
- Panchromatic plot with data, uncertainty, baseline, and component models
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

SQRT2PI = math.sqrt(2.0 * math.pi)
SQRT8LN2 = math.sqrt(8.0 * math.log(2.0))
C_CGS = 2.99792458e10
JY_TO_CGS = 1e-23
R_OIII_5008_4960 = 2.98
R_SIII_9533_9071 = 2.44

PRISM_R_COEFFS = (
    0.6588751520824567,
    -13.160715906787065,
    105.20050050555237,
    -429.52868537465565,
    959.0507565400321,
    -1043.4918213547285,
    480.90575759267125,
)

BREAK_REST_UM = [0.121567, 0.3646, 0.4000]

LINE_MAP: dict[str, tuple[str, float]] = {
    "lya_1216": ("Lyα", 0.121567),
    "niv_1486": ("N IV]", 0.148650),
    "civ_1549": ("[C IV]", 0.154948),
    "heii_1640": ("He II 1640", 0.164042),
    "oiii_1661": ("O III] 1661", 0.166081),
    "oiii_1666": ("O III] 1666", 0.166615),
    "ciii_1908": ("[C III] 1908", 0.190873),
    "mgii_2799": ("Mg II", 0.279912),
    "oii_3729": ("[O II]", 0.372850),
    "neiii_3869": ("[Ne III]", 0.386876),
    "neiii_3968": ("[Ne III]", 0.396747),
    "hdelta": ("Hδ", 0.410289),
    "hgamma": ("Hγ", 0.434168),
    "oiii_4363": ("[O III]4363", 0.436334),
    "hbeta": ("Hβ", 0.486267),
    "oiii_4960": ("[O III]4960", 0.4960295),
    "oiii_5008": ("[O III]5008", 0.500824),
    "hei_5876": ("He I 5876", 0.587562),
    "ha_nii_complex": ("Hα+[NII] complex", 0.656461),
    "ha_nii_sii_complex": ("Hα+[NII]+[SII] complex", 0.656461),
    "sii_6725": ("[S II]", 0.672548),
    "hei_7065": ("He I 7065", 0.706518),
    "siii_9071": ("[S III]9071", 0.90711),
    "siii_9533": ("[S III]9533", 0.953321),
    "padelta_10052": ("Paδ", 1.00521),
    "hei_10830": ("He I 10830", 1.0833),
    "pagamma_10941": ("Paγ", 1.0941),
    "pabeta_12822": ("Paβ", 1.28215),
    "feii_12570": ("[Fe II] 1.257", 1.25702),
    "feii_16440": ("[Fe II] 1.644", 1.64405),
    "paalpha_18756": ("Paα", 1.8756),
    "hei_20592": ("He I 20592", 2.05925),
    "h2_21224": ("H2 2.122", 2.12238),
    "brgamma_21661": ("Brγ", 2.1661),
    "h2_24073": ("H2 2.407", 2.40726),
    "h2_24244": ("H2 2.424", 2.42436),
    "brbeta_26258": ("Brβ", 2.62584),
    "h2_28033": ("H2 2.803", 2.80326),
    "pah_33000": ("PAH 3.3", 3.29),
    "pf8_37405": ("Pf8", 3.74052),
    "bralpha_40522": ("Brα", 4.05223),
}

FORBIDDEN_IDS = {lid for lid, (name, _r) in LINE_MAP.items() if ("[" in name or "]" in name)}
NONNEG_IDS = FORBIDDEN_IDS | {"ha_nii_complex", "ha_nii_sii_complex"}


def jy_to_flam(flux_jy: float, wave_um: float) -> float:
    wave_cm = wave_um * 1e-4
    return flux_jy * JY_TO_CGS * C_CGS / (wave_cm * wave_cm) * 1e-8


def flam_to_jy(flux_flam: float, wave_um: float) -> float:
    wave_cm = wave_um * 1e-4
    return flux_flam / (JY_TO_CGS * C_CGS / (wave_cm * wave_cm) * 1e-8)


def polyval_desc(coeffs: tuple[float, ...], x: float) -> float:
    y = 0.0
    for c in coeffs:
        y = y * x + c
    return y


def prism_r(obs_um: float) -> float:
    r = polyval_desc(PRISM_R_COEFFS, obs_um)
    return r if (math.isfinite(r) and r > 0) else 100.0


def prism_sigma_a(obs_a: float) -> float:
    fwhm = obs_a / prism_r(obs_a / 1e4)
    return max(fwhm / SQRT8LN2, 1e-6)


def gaussian(x: np.ndarray, mu: float, sigma: float) -> np.ndarray:
    z = (x - mu) / sigma
    return np.exp(-0.5 * z * z)


def smooth_heaviside(x: np.ndarray, x0: float, tau: float) -> np.ndarray:
    z = np.clip((x - x0) / max(tau, 1e-6), -60, 60)
    return 1.0 / (1.0 + np.exp(-z))


def linear_fit(A: np.ndarray, y: np.ndarray, s: np.ndarray):
    w = 1.0 / (s * s)
    ata = A.T @ (w[:, None] * A)
    atb = A.T @ (w * y)
    try:
        coeff = np.linalg.solve(ata, atb)
    except np.linalg.LinAlgError:
        return None, None, np.inf
    model = A @ coeff
    chi2 = np.sum(((y - model) / s) ** 2)
    dof = max(1, len(y) - A.shape[1])
    redchi2 = chi2 / dof
    try:
        cov = np.linalg.inv(ata)
    except np.linalg.LinAlgError:
        cov = None
    return coeff, cov, redchi2


def parse_sid(path: Path) -> str:
    stem = path.stem
    toks = stem.split("_")
    for t in toks:
        if t.isdigit():
            return t
    return stem


def default_groups(include_sii_in_complex: bool, ha_sii_mode: str) -> list[list[str]]:
    groups = [
        ["lya_1216"],
        ["niv_1486"],
        ["civ_1549"],
        ["heii_1640", "oiii_1661", "oiii_1666"],
        ["ciii_1908"],
        ["mgii_2799"],
        ["oii_3729", "neiii_3869", "neiii_3968", "hdelta"],
        ["hgamma", "oiii_4363"],
        ["hbeta", "oiii_4960", "oiii_5008"],
        ["hei_5876"],
        ["ha_nii_sii_complex"] if (include_sii_in_complex and ha_sii_mode == "single") else (
            ["ha_nii_complex", "sii_6725"] if include_sii_in_complex else ["ha_nii_complex"]
        ),
        [] if include_sii_in_complex else ["sii_6725"],
        ["hei_7065"],
        ["siii_9071", "siii_9533"],
        ["padelta_10052"],
        ["hei_10830", "pagamma_10941"],
        ["feii_12570"],
        ["pabeta_12822"],
        ["feii_16440"],
        ["paalpha_18756"],
        ["hei_20592"],
        ["h2_21224"],
        ["brgamma_21661"],
        ["h2_24073"],
        ["h2_24244"],
        ["brbeta_26258"],
        ["h2_28033"],
        ["pah_33000"],
        ["pf8_37405"],
        ["bralpha_40522"],
    ]
    return [g for g in groups if g]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spectrum-json", type=Path, required=True)
    ap.add_argument("--z", type=float, required=True)
    ap.add_argument("--output-json", type=Path, default=None)
    ap.add_argument("--output-plot", type=Path, default=None)
    ap.add_argument("--snr-threshold", type=float, default=3.0)
    ap.add_argument(
        "--ha-sii-mode",
        choices=["auto", "split", "single"],
        default="auto",
        help="Handling of Halpha+[NII] and [SII] when close in prism: auto/split/single-complex.",
    )
    ap.add_argument(
        "--pah33-rest-fwhm-um",
        type=float,
        default=0.06,
        help="Rest-frame FWHM (um) used to broaden PAH 3.3um template beyond LSF.",
    )
    args = ap.parse_args()

    if args.output_json is None:
        args.output_json = args.spectrum_json.with_name(f"{args.spectrum_json.stem}_joint_lsf_fit.json")
    if args.output_plot is None:
        args.output_plot = args.spectrum_json.with_name(f"{args.spectrum_json.stem}_joint_lsf_fit.png")

    payload = json.loads(args.spectrum_json.read_text(encoding="utf-8"))
    w_um = np.asarray(payload["spectrum"]["wavelength"], dtype=float)
    f_jy = np.asarray(payload["spectrum"]["flux"], dtype=float)
    e_jy = np.asarray(payload["spectrum"]["flux_error"], dtype=float)
    m = np.isfinite(w_um) & np.isfinite(f_jy) & np.isfinite(e_jy) & (e_jy > 0)
    w_um = w_um[m]
    f_jy = f_jy[m]
    e_jy = e_jy[m]
    w_a = w_um * 1e4
    f = np.array([jy_to_flam(ff, ww) for ff, ww in zip(f_jy, w_um)])
    e = np.array([abs(jy_to_flam(ee, ww)) for ee, ww in zip(e_jy, w_um)])
    order = np.argsort(w_a)
    w_a = w_a[order]
    f = f[order]
    e = e[order]
    med_step = float(np.median(np.diff(w_a)))

    z = float(args.z)
    sid = parse_sid(args.spectrum_json)

    obs_ha = LINE_MAP["ha_nii_complex"][1] * (1 + z) * 1e4
    obs_sii = LINE_MAP["sii_6725"][1] * (1 + z) * 1e4
    ha_sii_sep = abs(obs_sii - obs_ha)
    ha_lsf_fwhm = obs_ha / prism_r(obs_ha / 1e4)
    include_sii_in_complex = ha_sii_sep < 1.5 * ha_lsf_fwhm

    ha_sii_mode = args.ha_sii_mode
    if ha_sii_mode == "auto":
        ha_sii_mode_eff = "single" if include_sii_in_complex else "split"
    else:
        ha_sii_mode_eff = ha_sii_mode
    groups = default_groups(include_sii_in_complex, ha_sii_mode_eff)
    skipped: list[dict] = []
    line_results: list[dict] = []
    groups_for_plot: list[dict] = []

    for gids in groups:
        ids = []
        for lid in gids:
            obs = LINE_MAP[lid][1] * (1 + z) * 1e4
            if w_a[0] <= obs <= w_a[-1]:
                ids.append(lid)
            else:
                skipped.append({"line_id": lid, "reason": "out_of_range", "obs_A": float(obs)})
        if not ids:
            continue

        if "hgamma" in ids and "oiii_4363" in ids:
            ohg = LINE_MAP["hgamma"][1] * (1 + z) * 1e4
            oo3 = LINE_MAP["oiii_4363"][1] * (1 + z) * 1e4
            dlam = abs(ohg - oo3)
            fwhm_pair = 0.5 * (ohg / prism_r(ohg / 1e4) + oo3 / prism_r(oo3 / 1e4))
            if dlam < 0.9 * fwhm_pair:
                ids = [x for x in ids if x != "oiii_4363"]

        centers = np.array([LINE_MAP[l][1] * (1 + z) * 1e4 for l in ids], dtype=float)
        sigmas = np.array([prism_sigma_a(c) for c in centers], dtype=float)
        fwhm_guess = np.array([max(med_step * 2.2, c / 120.0) for c in centers], dtype=float)

        if set(ids) == {"hbeta", "oiii_4960", "oiii_5008"}:
            scale, min_pix = 5.8, 10.0
        elif set(ids) == {"oii_3729", "neiii_3869", "neiii_3968", "hdelta"}:
            scale, min_pix = 5.5, 12.0
        elif set(ids) == {"ha_nii_complex"} or set(ids) == {"ha_nii_complex", "sii_6725"}:
            scale, min_pix = 8.0, 14.0
        else:
            scale, min_pix = 3.0, 5.0

        wing = np.maximum(scale * fwhm_guess, med_step * min_pix)
        win_lo = float(np.min(centers - wing))
        win_hi = float(np.max(centers + wing))
        idx = np.where((w_a >= win_lo) & (w_a <= win_hi))[0]
        if len(idx) < max(6, int(min_pix)):
            skipped.extend({"line_id": lid, "reason": "too_few_pixels"} for lid in ids)
            continue

        x = w_a[idx]
        y = f[idx]
        s = e[idx]
        x0 = float(np.mean(x))
        xscale = max(float(np.std(x)), 1.0)

        break_basis = []
        for br in BREAK_REST_UM:
            bobs = br * (1 + z) * 1e4
            if (win_lo - 0.5 * (win_hi - win_lo)) <= bobs <= (win_hi + 0.5 * (win_hi - win_lo)):
                tau = max(2.0 * med_step, 0.002 * bobs)
                break_basis.append((br, bobs, tau, smooth_heaviside(x, bobs, tau)))

        shift_max = max(float(np.mean(fwhm_guess) * 0.8), med_step)
        shift_step = max(med_step / 3.0, 2.0)
        shifts = np.arange(-shift_max, shift_max + 0.5 * shift_step, shift_step)
        use_quad_baseline = "ha_nii_complex" in ids

        unresolved_oiii = False
        unresolved_siii = False
        if "oiii_4960" in ids and "oiii_5008" in ids:
            c49 = centers[ids.index("oiii_4960")]
            c50 = centers[ids.index("oiii_5008")]
            unresolved_oiii = abs(c50 - c49) < 1.5 * 0.5 * (c49 / prism_r(c49 / 1e4) + c50 / prism_r(c50 / 1e4))
        if "siii_9071" in ids and "siii_9533" in ids:
            c91 = centers[ids.index("siii_9071")]
            c95 = centers[ids.index("siii_9533")]
            unresolved_siii = abs(c95 - c91) < 1.5 * 0.5 * (c91 / prism_r(c91 / 1e4) + c95 / prism_r(c95 / 1e4))

        best = None
        best_A = None
        best_cov = None
        best_red = np.inf

        for sh in shifts:
            cols: list[np.ndarray] = [np.ones_like(x), x - x0]
            if use_quad_baseline:
                cols.append(((x - x0) / xscale) ** 2)
            for _br, _bobs, _tau, hb in break_basis:
                cols.append(hb)

            coeff_meta: dict[str, tuple[int, float]] = {}

            def add_component(line_id: str, template: np.ndarray, mult: float = 1.0):
                idx_c = len(cols)
                cols.append(template)
                coeff_meta[line_id] = (idx_c, mult)

            for lid, c, sig in zip(ids, centers, sigmas):
                mu = c + sh
                sig_eff = sig
                if lid == "pah_33000":
                    pah_fwhm_obs_a = max(0.0, float(args.pah33_rest_fwhm_um)) * (1.0 + z) * 1e4
                    sig_pah = pah_fwhm_obs_a / SQRT8LN2
                    sig_eff = math.sqrt(sig * sig + sig_pah * sig_pah)
                if lid == "oiii_5008":
                    continue
                if lid == "oiii_4960" and "oiii_5008" in ids:
                    g49 = gaussian(x, mu, sig_eff)
                    j50 = ids.index("oiii_5008")
                    g50 = gaussian(x, centers[j50] + sh, sigmas[j50])
                    if unresolved_oiii:
                        add_component("oiii_4960", g49 + R_OIII_5008_4960 * g50, 1.0)
                        coeff_meta["oiii_5008"] = coeff_meta["oiii_4960"][0], R_OIII_5008_4960
                    else:
                        add_component("oiii_4960", g49, 1.0)
                        coeff_meta["oiii_5008"] = coeff_meta["oiii_4960"][0], R_OIII_5008_4960
                    continue
                if lid == "siii_9533":
                    continue
                if lid == "siii_9071" and "siii_9533" in ids:
                    g91 = gaussian(x, mu, sig_eff)
                    j95 = ids.index("siii_9533")
                    g95 = gaussian(x, centers[j95] + sh, sigmas[j95])
                    if unresolved_siii:
                        add_component("siii_9071", g91 + R_SIII_9533_9071 * g95, 1.0)
                        coeff_meta["siii_9533"] = coeff_meta["siii_9071"][0], R_SIII_9533_9071
                    else:
                        add_component("siii_9071", g91, 1.0)
                        coeff_meta["siii_9533"] = coeff_meta["siii_9071"][0], R_SIII_9533_9071
                    continue
                add_component(lid, gaussian(x, mu, sig_eff), 1.0)

            A = np.vstack(cols).T
            coeff, cov, red = linear_fit(A, y, s)
            if coeff is None:
                continue

            amps = {}
            for lid in ids:
                if lid not in coeff_meta:
                    continue
                ci, mult = coeff_meta[lid]
                amps[lid] = coeff[ci] * mult
            if any((lid in NONNEG_IDS and amps.get(lid, 0.0) < 0) for lid in ids):
                continue
            if red < best_red:
                best_red = red
                best = (sh, coeff, cov, ids, centers, sigmas, break_basis, coeff_meta, unresolved_oiii, unresolved_siii, use_quad_baseline, xscale)
                best_A = A
                best_cov = cov

        if best is None:
            skipped.extend({"line_id": lid, "reason": "no_feasible_solution"} for lid in ids)
            continue

        sh, coeff, cov, ids_fit, centers_fit, sig_fit, break_basis, coeff_meta, unresolved_oiii, unresolved_siii, use_quad_baseline, xscale = best
        base = coeff[0] + coeff[1] * (x - x0)
        c0 = 2
        if use_quad_baseline:
            base += coeff[c0] * ((x - x0) / xscale) ** 2
            c0 += 1
        for k, (_br, _bobs, _tau, hb) in enumerate(break_basis):
            base += coeff[c0 + k] * hb
        model = best_A @ coeff

        components = []
        for i, lid in enumerate(ids_fit):
            if lid not in coeff_meta:
                continue
            if unresolved_oiii and lid in {"oiii_4960", "oiii_5008"}:
                continue
            if unresolved_siii and lid in {"siii_9071", "siii_9533"}:
                continue
            amp = coeff[coeff_meta[lid][0]] * coeff_meta[lid][1]
            components.append((lid, amp * gaussian(x, centers_fit[i] + sh, sig_fit[i])))

            flux = float(amp * SQRT2PI * sig_fit[i])
            ferr = float("nan")
            snr = float("nan")
            if cov is not None:
                ci = coeff_meta[lid][0]
                mult = coeff_meta[lid][1]
                if ci < cov.shape[0] and cov[ci, ci] > 0:
                    aerr = abs(mult) * math.sqrt(float(cov[ci, ci]))
                    ferr = abs(float(SQRT2PI * sig_fit[i] * aerr))
                    snr = flux / ferr if ferr > 0 else float("nan")
            line_results.append(
                {
                    "line_id": lid,
                    "line_name": LINE_MAP[lid][0],
                    "obs_A": float(centers_fit[i]),
                    "flux": flux,
                    "flux_err": ferr,
                    "snr": snr,
                }
            )

        if unresolved_oiii and ("oiii_4960" in ids_fit and "oiii_5008" in ids_fit):
            i49 = ids_fit.index("oiii_4960")
            i50 = ids_fit.index("oiii_5008")
            cidx, _ = coeff_meta["oiii_4960"]
            amp49 = coeff[cidx]
            f49 = float(amp49 * SQRT2PI * sig_fit[i49])
            f50 = float((R_OIII_5008_4960 * amp49) * SQRT2PI * sig_fit[i50])
            ferr = float("nan")
            snr = float("nan")
            if cov is not None and cov[cidx, cidx] > 0:
                aerr = math.sqrt(float(cov[cidx, cidx]))
                e49 = abs(float(SQRT2PI * sig_fit[i49] * aerr))
                e50 = abs(float(SQRT2PI * sig_fit[i50] * R_OIII_5008_4960 * aerr))
                ferr = math.sqrt(e49 * e49 + e50 * e50)
                snr = (f49 + f50) / ferr if ferr > 0 else float("nan")
            line_results.append(
                {
                    "line_id": "oiii_49_50_complex",
                    "line_name": "[O III] 4960+5008 complex",
                    "obs_A": float(0.5 * (centers_fit[i49] + centers_fit[i50])),
                    "flux": float(f49 + f50),
                    "flux_err": ferr,
                    "snr": snr,
                }
            )

        if unresolved_siii and ("siii_9071" in ids_fit and "siii_9533" in ids_fit):
            i91 = ids_fit.index("siii_9071")
            i95 = ids_fit.index("siii_9533")
            cidx, _ = coeff_meta["siii_9071"]
            amp91 = coeff[cidx]
            f91 = float(amp91 * SQRT2PI * sig_fit[i91])
            f95 = float((R_SIII_9533_9071 * amp91) * SQRT2PI * sig_fit[i95])
            ferr = float("nan")
            snr = float("nan")
            if cov is not None and cov[cidx, cidx] > 0:
                aerr = math.sqrt(float(cov[cidx, cidx]))
                e91 = abs(float(SQRT2PI * sig_fit[i91] * aerr))
                e95 = abs(float(SQRT2PI * sig_fit[i95] * R_SIII_9533_9071 * aerr))
                ferr = math.sqrt(e91 * e91 + e95 * e95)
                snr = (f91 + f95) / ferr if ferr > 0 else float("nan")
            line_results.append(
                {
                    "line_id": "siii_91_95_complex",
                    "line_name": "[S III] 9071+9533 complex",
                    "obs_A": float(0.5 * (centers_fit[i91] + centers_fit[i95])),
                    "flux": float(f91 + f95),
                    "flux_err": ferr,
                    "snr": snr,
                }
            )

        segment_line_ids = list(ids_fit)
        if unresolved_oiii and "oiii_49_50_complex" not in segment_line_ids:
            segment_line_ids.append("oiii_49_50_complex")
        if unresolved_siii and "siii_91_95_complex" not in segment_line_ids:
            segment_line_ids.append("siii_91_95_complex")

        groups_for_plot.append(
            {
                "label": ",".join(ids_fit),
                "x_A": x.tolist(),
                "baseline": base.tolist(),
                "model": model.tolist(),
                "redchi2": float(best_red),
                "break_terms": [(br, bobs, tau) for br, bobs, tau, _ in break_basis],
                "components": [(lid, arr.tolist()) for lid, arr in components],
                "unresolved_oiii": unresolved_oiii,
                "unresolved_siii": unresolved_siii,
                "segment_line_ids": segment_line_ids,
            }
        )

    best_by_id = {}
    for r in line_results:
        lid = r["line_id"]
        if lid not in best_by_id or (math.isfinite(r["snr"]) and r["snr"] > best_by_id[lid]["snr"]):
            best_by_id[lid] = r
    line_results = sorted(best_by_id.values(), key=lambda t: t["obs_A"])
    detected = [r for r in line_results if math.isfinite(r["snr"]) and r["snr"] >= args.snr_threshold and r["flux"] > 0]

    detected_ids = {r["line_id"] for r in detected}
    model_segments = []
    for g in groups_for_plot:
        ids = g["segment_line_ids"]
        if not any(i in detected_ids for i in ids):
            continue
        x_a = np.asarray(g["x_A"], dtype=float)
        x_um = x_a / 1e4
        model_flam = np.asarray(g["model"], dtype=float)
        base_flam = np.asarray(g["baseline"], dtype=float)
        model_jy = [float(flam_to_jy(mf, wu)) for mf, wu in zip(model_flam, x_um)]
        base_jy = [float(flam_to_jy(bf, wu)) for bf, wu in zip(base_flam, x_um)]
        model_segments.append(
            {
                "label": g["label"],
                "line_ids": ids,
                "x_A": g["x_A"],
                "x_um": [float(v) for v in x_um.tolist()],
                "baseline_flam": g["baseline"],
                "model_flam": g["model"],
                "baseline_jy": base_jy,
                "model_jy": model_jy,
            }
        )

    out = {
        "meta": {
            "target_sid": sid,
            "z": z,
            "fit_mode": "joint_lsf_trained_v1",
            "oiii_5008_over_4960": R_OIII_5008_4960,
            "siii_9533_over_9071": R_SIII_9533_9071,
            "ha_nii_always_complex": True,
            "sii_in_same_complex": bool(include_sii_in_complex),
            "ha_sii_mode": ha_sii_mode_eff,
            "ha_sii_sep_A": float(ha_sii_sep),
            "ha_lsf_fwhm_A": float(ha_lsf_fwhm),
            "snr_threshold": args.snr_threshold,
            "pah33_rest_fwhm_um": float(args.pah33_rest_fwhm_um),
        },
        "line_results": line_results,
        "detected_gt3sigma": detected,
        "model_segments_detected": model_segments,
        "skipped": skipped,
        "joint_groups": [
            {
                "label": g["label"],
                "redchi2": float(g["redchi2"]),
                "break_terms": [[float(a), float(b), float(c)] for a, b, c in g["break_terms"]],
                "unresolved_oiii": bool(g["unresolved_oiii"]),
                "unresolved_siii": bool(g["unresolved_siii"]),
            }
            for g in groups_for_plot
        ],
    }
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(out, indent=2), encoding="utf-8")

    fig, ax = plt.subplots(figsize=(15, 6))
    ax.plot(w_a / 1e4, f, color="black", lw=1.0, label="Prism spectrum")
    ax.fill_between(w_a / 1e4, f - e, f + e, color="0.7", alpha=0.35, linewidth=0, label="1σ uncertainty")
    colors = plt.cm.tab20(np.linspace(0, 1, max(12, sum(len(g["components"]) for g in groups_for_plot))))
    ci = 0
    for g in groups_for_plot:
        x = np.array(g["x_A"]) / 1e4
        base = np.array(g["baseline"])
        tot = np.array(g["model"])
        ax.plot(x, base, color="0.35", ls="--", lw=1.1, alpha=0.85)
        ax.plot(x, tot, color="k", lw=1.3, alpha=0.45)
        for lid, comp in g["components"]:
            c = colors[ci % len(colors)]
            ci += 1
            ax.plot(x, base + np.array(comp), color=c, lw=1.6, alpha=0.95, label=lid)
    ax.set_xlim(float(w_a.min() / 1e4), float(w_a.max() / 1e4))
    ax.set_xlabel("Wavelength (um)")
    ax.set_ylabel(r"f$_\lambda$ (erg s$^{-1}$ cm$^{-2}$ A$^{-1}$)")
    ax.set_title(f"JADES-{sid}: Joint PRISM-LSF Line Fits")
    ax.grid(alpha=0.2)
    h, l = ax.get_legend_handles_labels()
    seen = set()
    hh = []
    ll = []
    for hi, li in zip(h, l):
        if li in seen:
            continue
        seen.add(li)
        hh.append(hi)
        ll.append(li)
    ax.legend(hh, ll, loc="upper right", fontsize=7, ncol=3, frameon=True)
    fig.tight_layout()
    args.output_plot.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(args.output_plot, dpi=200)

    print(f"saved_json {args.output_json}")
    print(f"saved_plot {args.output_plot}")
    print(f"det_gt3_count {len(detected)}")
    for r in detected:
        print(f"{r['line_name']} {r['line_id']} flux={r['flux']:.3e} snr={r['snr']:.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
