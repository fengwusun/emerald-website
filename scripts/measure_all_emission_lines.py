#!/usr/bin/env python3
"""Measure emission lines from a prism x1d JSON for a given redshift.

Features:
- Per-line local sideband continuum (linear) to avoid global-continuum assumptions
- Continuum-subtracted trapezoidal line flux + uncertainty
- Local Gaussian line flux + uncertainty
- Blend flags for overlapping line windows
- Explicit multi-line blend-group fits for key complexes
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from statistics import median

C_CGS = 2.99792458e10
JY_TO_CGS = 1e-23
SQRT2PI = math.sqrt(2.0 * math.pi)
R_OIII_5008_4960 = 2.98
R_SIII_9533_9071 = 2.44

EMISSION_LINES = [
    ("lya_1216", "Lyα", 0.121567),
    ("civ_1549", "[C IV]", 0.154948),
    ("niv_1486", "N IV]", 0.148650),
    ("heii_1640", "He II", 0.164042),
    ("oiii_1661", "O III]", 0.166081),
    ("oiii_1666", "O III]", 0.166615),
    ("ciii_1908", "[C III]", 0.190873),
    ("mgii_2799", "Mg II", 0.279912),
    ("oii_3729", "[O II]", 0.37285),
    ("neiii_3869", "[Ne III]", 0.386876),
    ("neiii_3968", "[Ne III]", 0.396747),
    ("hdelta", "Hδ", 0.410289),
    ("hgamma", "Hγ", 0.434168),
    ("oiii_4363", "[O III]", 0.436334),
    ("hbeta", "Hβ", 0.486267),
    ("oiii_4960", "[O III]", 0.4960295),
    ("oiii_5008", "[O III]", 0.500824),
    ("hei_5876", "He I", 0.587562),
    ("halpha", "Hα", 0.656461),
    ("nii_6585", "[N II]", 0.658527),
    ("sii_6725", "[S II]", 0.672548),
    ("siii_9071", "[S III]", 0.90711),
    ("siii_9533", "[S III]", 0.953321),
    ("padelta", "Paδ", 1.00521),
    ("hei_10833", "He I", 1.08333),
    ("pagamma", "Paγ", 1.0941),
    ("feii_12570", "[Fe II]", 1.25702),
    ("pabeta", "Paβ", 1.28215),
    ("feii_16440", "[Fe II]", 1.64405),
    ("paalpha", "Paα", 1.8756),
    ("hei_20592", "He I", 2.05925),
    ("h2_21224", "H₂", 2.12238),
    ("brgamma", "Brγ", 2.1661),
    ("h2_24073", "H₂", 2.40726),
    ("h2_24244", "H₂", 2.42436),
    ("brbeta", "Brβ", 2.62584),
    ("h2_28033", "H₂", 2.80326),
    ("pah_32900", "PAH", 3.29),
    ("pf8", "Pf8", 3.74052),
    ("bralpha", "Brα", 4.05223),
]

LINE_REST_UM = {line_id: rest_um for line_id, _name, rest_um in EMISSION_LINES}
BLEND_GROUPS = [
    ("uv_1640_166x", ["heii_1640", "oiii_1661", "oiii_1666"]),
    ("neiii_hdelta_hg_4363", ["neiii_3869", "neiii_3968", "hdelta", "hgamma", "oiii_4363"]),
    ("hb_oiii", ["hbeta", "oiii_4960", "oiii_5008"]),
    ("ha_nii_sii", ["halpha", "nii_6585", "sii_6725"]),
]

# Enforce non-negative Gaussian amplitudes for these forbidden-line components.
NONNEGATIVE_FORBIDDEN_COMPONENTS = {"nii_6585", "sii_6725"}


@dataclass
class Spectrum:
    wave_a: list[float]
    flux: list[float]
    err: list[float]
    median_step_a: float


@dataclass
class LineMeasurement:
    line_id: str
    line_name: str
    rest_um: float
    obs_a: float
    in_range: bool
    n_line_pts: int
    n_cont_pts: int
    line_lo_a: float
    line_hi_a: float
    trap_flux: float
    trap_err: float
    trap_snr: float
    gauss_flux: float
    gauss_err: float
    gauss_snr: float
    gauss_sigma_a: float
    gauss_shift_a: float
    redchi2: float
    blend_flag: bool
    blend_neighbors: str


@dataclass
class BlendMeasurement:
    group_id: str
    member_ids: str
    center_lo_a: float
    center_hi_a: float
    n_line_pts: int
    n_cont_pts: int
    trap_flux: float
    trap_err: float
    trap_snr: float
    gauss_flux_sum: float
    gauss_flux_err: float
    gauss_snr: float
    redchi2: float
    component_fluxes: str


@dataclass
class PhysicsConstraintResult:
    name: str
    trap_flux: float
    trap_err: float
    trap_snr: float
    gauss_flux: float
    gauss_err: float
    gauss_snr: float


def jy_to_flam(flux_jy: float, wave_um: float) -> float:
    wave_cm = wave_um * 1e-4
    if wave_cm <= 0:
        return float("nan")
    return flux_jy * JY_TO_CGS * C_CGS / (wave_cm * wave_cm) * 1e-8


def read_spectrum(path: Path) -> Spectrum:
    payload = json.loads(path.read_text(encoding="utf-8"))
    w_um = payload["spectrum"]["wavelength"]
    f_jy = payload["spectrum"]["flux"]
    e_jy = payload["spectrum"]["flux_error"]
    n = min(len(w_um), len(f_jy), len(e_jy))

    wave_a: list[float] = []
    flux: list[float] = []
    err: list[float] = []

    for i in range(n):
        wu = float(w_um[i])
        wa = wu * 1e4
        ff = jy_to_flam(float(f_jy[i]), wu)
        ee = jy_to_flam(abs(float(e_jy[i])), wu)
        if not (math.isfinite(wa) and math.isfinite(ff) and math.isfinite(ee) and ee > 0):
            continue
        wave_a.append(wa)
        flux.append(ff)
        err.append(ee)

    order = sorted(range(len(wave_a)), key=lambda i: wave_a[i])
    wave_a = [wave_a[i] for i in order]
    flux = [flux[i] for i in order]
    err = [err[i] for i in order]

    steps = [wave_a[i + 1] - wave_a[i] for i in range(len(wave_a) - 1)]
    med = median(steps) if steps else 1.0
    return Spectrum(wave_a=wave_a, flux=flux, err=err, median_step_a=med)


def select_idx(wave_a: list[float], lo: float, hi: float) -> list[int]:
    return [i for i, w in enumerate(wave_a) if lo <= w <= hi]


def weighted_linear_fit(x: list[float], y: list[float], sigma: list[float]) -> tuple[float, float]:
    w = [1.0 / (s * s) for s in sigma]
    sw = sum(w)
    if sw <= 0:
        return 0.0, 0.0
    sx = sum(wi * xi for wi, xi in zip(w, x))
    sy = sum(wi * yi for wi, yi in zip(w, y))
    sxx = sum(wi * xi * xi for wi, xi in zip(w, x))
    sxy = sum(wi * xi * yi for wi, xi, yi in zip(w, x, y))
    denom = sw * sxx - sx * sx
    if abs(denom) < 1e-30:
        return sy / sw, 0.0
    b = (sw * sxy - sx * sy) / denom
    a = (sy - b * sx) / sw
    return a, b


def trapz_integral(x: list[float], y: list[float]) -> float:
    if len(x) < 2:
        return 0.0
    s = 0.0
    for i in range(len(x) - 1):
        dx = x[i + 1] - x[i]
        s += 0.5 * dx * (y[i] + y[i + 1])
    return s


def trapz_err(x: list[float], sigma: list[float]) -> float:
    if len(x) < 2:
        return float("nan")
    var = 0.0
    for i in range(len(x) - 1):
        dx = x[i + 1] - x[i]
        seg = 0.5 * dx * math.sqrt(sigma[i] * sigma[i] + sigma[i + 1] * sigma[i + 1])
        var += seg * seg
    return math.sqrt(var)


def gaussian(x: float, mu: float, sigma: float) -> float:
    z = (x - mu) / sigma
    return math.exp(-0.5 * z * z)


def solve_linear(a: list[list[float]], b: list[float]) -> list[float]:
    n = len(b)
    aug = [a[i][:] + [b[i]] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[piv][col]) < 1e-30:
            return [0.0] * n
        aug[col], aug[piv] = aug[piv], aug[col]
        p = aug[col][col]
        for j in range(col, n + 1):
            aug[col][j] /= p
        for r in range(n):
            if r == col:
                continue
            f = aug[r][col]
            for j in range(col, n + 1):
                aug[r][j] -= f * aug[col][j]
    return [aug[i][n] for i in range(n)]


def inverse_matrix(m: list[list[float]]) -> list[list[float]] | None:
    n = len(m)
    aug = [m[i][:] + [1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[piv][col]) < 1e-30:
            return None
        aug[col], aug[piv] = aug[piv], aug[col]
        p = aug[col][col]
        for j in range(2 * n):
            aug[col][j] /= p
        for r in range(n):
            if r == col:
                continue
            f = aug[r][col]
            for j in range(2 * n):
                aug[r][j] -= f * aug[col][j]
    return [row[n:] for row in aug]


def linear_fit_with_cov(design: list[list[float]], y: list[float], sigma: list[float]) -> tuple[list[float], list[list[float]] | None, float]:
    p = len(design[0])
    ata = [[0.0 for _ in range(p)] for _ in range(p)]
    atb = [0.0 for _ in range(p)]

    for row, yi, si in zip(design, y, sigma):
        wi = 1.0 / (si * si)
        for i in range(p):
            atb[i] += wi * row[i] * yi
            for j in range(p):
                ata[i][j] += wi * row[i] * row[j]

    coeffs = solve_linear(ata, atb)

    chi2 = 0.0
    dof = max(1, len(y) - p)
    for row, yi, si in zip(design, y, sigma):
        model = sum(ci * ri for ci, ri in zip(coeffs, row))
        r = (yi - model) / si
        chi2 += r * r
    redchi2 = chi2 / dof

    cov = inverse_matrix(ata)
    return coeffs, cov, redchi2


def frange(start: float, stop: float, step: float):
    n = int(round((stop - start) / step))
    for i in range(n + 1):
        yield start + i * step


def measure_one_line(spec: Spectrum, line_id: str, name: str, rest_um: float, z: float) -> LineMeasurement:
    obs_a = rest_um * (1.0 + z) * 1e4
    if not (spec.wave_a[0] <= obs_a <= spec.wave_a[-1]):
        return LineMeasurement(
            line_id, name, rest_um, obs_a, False, 0, 0,
            obs_a, obs_a, float("nan"), float("nan"), float("nan"),
            float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"),
            False, ""
        )

    fwhm_guess = max(spec.median_step_a * 2.2, obs_a / 120.0)
    half_line = max(1.3 * fwhm_guess, spec.median_step_a * 2.0)
    line_lo = obs_a - half_line
    line_hi = obs_a + half_line

    cont_gap = 1.7 * fwhm_guess
    cont_width = 2.0 * fwhm_guess
    left_lo = obs_a - cont_gap - cont_width
    left_hi = obs_a - cont_gap
    right_lo = obs_a + cont_gap
    right_hi = obs_a + cont_gap + cont_width

    idx_line = select_idx(spec.wave_a, line_lo, line_hi)
    idx_cont = select_idx(spec.wave_a, left_lo, left_hi) + select_idx(spec.wave_a, right_lo, right_hi)

    if len(idx_line) < 4 or len(idx_cont) < 6:
        return LineMeasurement(
            line_id, name, rest_um, obs_a, True, len(idx_line), len(idx_cont),
            line_lo, line_hi, float("nan"), float("nan"), float("nan"),
            float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"),
            False, ""
        )

    x_cont = [spec.wave_a[i] for i in idx_cont]
    y_cont = [spec.flux[i] for i in idx_cont]
    s_cont = [spec.err[i] for i in idx_cont]
    a, b = weighted_linear_fit(x_cont, y_cont, s_cont)

    x_line = [spec.wave_a[i] for i in idx_line]
    y_line_cs = [spec.flux[i] - (a + b * spec.wave_a[i]) for i in idx_line]
    s_line = [spec.err[i] for i in idx_line]

    trap_flux = trapz_integral(x_line, y_line_cs)
    trap_err = trapz_err(x_line, s_line)
    trap_snr = trap_flux / trap_err if (math.isfinite(trap_err) and trap_err > 0) else float("nan")

    sigma_min = max(0.45 * fwhm_guess, spec.median_step_a * 1.1)
    sigma_max = max(2.2 * fwhm_guess, sigma_min + spec.median_step_a)
    sigma_step = max(spec.median_step_a / 3.0, 2.0)
    shift_max = max(0.8 * fwhm_guess, spec.median_step_a)
    shift_step = max(spec.median_step_a / 3.0, 2.0)

    x0 = sum(x_line) / len(x_line)
    y_raw = [spec.flux[i] for i in idx_line]

    best = None
    best_cov = None
    best_redchi2 = float("inf")

    for sig in frange(sigma_min, sigma_max, sigma_step):
        for shift in frange(-shift_max, shift_max, shift_step):
            mu = obs_a + shift
            design = [[1.0, x - x0, gaussian(x, mu, sig)] for x in x_line]
            coeffs, cov, redchi2 = linear_fit_with_cov(design, y_raw, s_line)
            if redchi2 < best_redchi2:
                best = (coeffs, sig, shift)
                best_cov = cov
                best_redchi2 = redchi2

    if best is None:
        gauss_flux = float("nan")
        gauss_err = float("nan")
        gauss_snr = float("nan")
        gauss_sigma = float("nan")
        gauss_shift = float("nan")
    else:
        coeffs, gauss_sigma, gauss_shift = best
        amp = coeffs[2]
        gauss_flux = amp * SQRT2PI * gauss_sigma
        if best_cov is not None and len(best_cov) >= 3 and len(best_cov[2]) >= 3 and best_cov[2][2] > 0:
            amp_err = math.sqrt(best_cov[2][2])
            gauss_err = abs(SQRT2PI * gauss_sigma * amp_err)
            gauss_snr = gauss_flux / gauss_err if gauss_err > 0 else float("nan")
        else:
            gauss_err = float("nan")
            gauss_snr = float("nan")

    if line_id in NONNEGATIVE_FORBIDDEN_COMPONENTS and math.isfinite(gauss_flux) and gauss_flux < 0:
        gauss_flux = 0.0
        if math.isfinite(gauss_err) and gauss_err > 0:
            gauss_snr = 0.0

    return LineMeasurement(
        line_id=line_id,
        line_name=name,
        rest_um=rest_um,
        obs_a=obs_a,
        in_range=True,
        n_line_pts=len(idx_line),
        n_cont_pts=len(idx_cont),
        line_lo_a=line_lo,
        line_hi_a=line_hi,
        trap_flux=trap_flux,
        trap_err=trap_err,
        trap_snr=trap_snr,
        gauss_flux=gauss_flux,
        gauss_err=gauss_err,
        gauss_snr=gauss_snr,
        gauss_sigma_a=gauss_sigma,
        gauss_shift_a=gauss_shift,
        redchi2=best_redchi2,
        blend_flag=False,
        blend_neighbors="",
    )


def measure_blend_group(spec: Spectrum, group_id: str, line_ids: list[str], z: float) -> BlendMeasurement:
    centers = [LINE_REST_UM[line_id] * (1.0 + z) * 1e4 for line_id in line_ids]
    c_lo = min(centers)
    c_hi = max(centers)
    c_mid = 0.5 * (c_lo + c_hi)

    if c_hi < spec.wave_a[0] or c_lo > spec.wave_a[-1]:
        return BlendMeasurement(group_id, ",".join(line_ids), c_lo, c_hi, 0, 0, float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), "")

    fwhm_guess = max(spec.median_step_a * 2.2, c_mid / 120.0)
    half_line = max(0.9 * (c_hi - c_lo) + 1.5 * fwhm_guess, spec.median_step_a * 3.0)
    line_lo = c_mid - half_line
    line_hi = c_mid + half_line

    cont_gap = 1.8 * fwhm_guess
    cont_width = 2.3 * fwhm_guess
    left_lo = line_lo - cont_gap - cont_width
    left_hi = line_lo - cont_gap
    right_lo = line_hi + cont_gap
    right_hi = line_hi + cont_gap + cont_width

    idx_line = select_idx(spec.wave_a, line_lo, line_hi)
    idx_cont = select_idx(spec.wave_a, left_lo, left_hi) + select_idx(spec.wave_a, right_lo, right_hi)

    if len(idx_line) < 6 or len(idx_cont) < 6:
        return BlendMeasurement(group_id, ",".join(line_ids), c_lo, c_hi, len(idx_line), len(idx_cont), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), "")

    x_cont = [spec.wave_a[i] for i in idx_cont]
    y_cont = [spec.flux[i] for i in idx_cont]
    s_cont = [spec.err[i] for i in idx_cont]
    a, b = weighted_linear_fit(x_cont, y_cont, s_cont)

    x_line = [spec.wave_a[i] for i in idx_line]
    y_line_cs = [spec.flux[i] - (a + b * spec.wave_a[i]) for i in idx_line]
    s_line = [spec.err[i] for i in idx_line]

    trap_flux = trapz_integral(x_line, y_line_cs)
    trap_err = trapz_err(x_line, s_line)
    trap_snr = trap_flux / trap_err if (math.isfinite(trap_err) and trap_err > 0) else float("nan")

    sigma_min = max(0.45 * fwhm_guess, spec.median_step_a * 1.1)
    sigma_max = max(2.2 * fwhm_guess, sigma_min + spec.median_step_a)
    sigma_step = max(spec.median_step_a / 3.0, 2.0)
    shift_max = max(0.8 * fwhm_guess, spec.median_step_a)
    shift_step = max(spec.median_step_a / 3.0, 2.0)

    x0 = sum(x_line) / len(x_line)
    y_raw = [spec.flux[i] for i in idx_line]

    best = None
    best_cov = None
    best_redchi2 = float("inf")

    def constrained_fit_for_grid(sig: float, shift: float):
        x0_local = x0
        y_local = y_raw
        s_local = s_line

        # Active-set loop: constrained forbidden components that go negative are fixed to 0.
        active = [True] * len(line_ids)
        while True:
            active_ids = [i for i, is_on in enumerate(active) if is_on]
            design = []
            for x in x_line:
                row = [1.0, x - x0_local]
                for i in active_ids:
                    row.append(gaussian(x, centers[i] + shift, sig))
                design.append(row)

            coeffs_sub, cov_sub, redchi2_sub = linear_fit_with_cov(design, y_local, s_local)
            cont0 = coeffs_sub[0]
            cont1 = coeffs_sub[1]
            amps = [0.0] * len(line_ids)
            for k, i in enumerate(active_ids):
                amps[i] = coeffs_sub[2 + k]

            to_deactivate: list[int] = []
            for i, line_id in enumerate(line_ids):
                if (
                    line_id in NONNEGATIVE_FORBIDDEN_COMPONENTS
                    and active[i]
                    and amps[i] < 0
                ):
                    to_deactivate.append(i)

            if not to_deactivate:
                # Build full-model redchi2 using active/inactive components.
                chi2 = 0.0
                dof = max(1, len(y_local) - (2 + len(active_ids)))
                for xv, yv, sv in zip(x_line, y_local, s_local):
                    model = cont0 + cont1 * (xv - x0_local)
                    for i, amp in enumerate(amps):
                        if amp == 0.0:
                            continue
                        model += amp * gaussian(xv, centers[i] + shift, sig)
                    r = (yv - model) / sv
                    chi2 += r * r
                return (cont0, cont1, amps, cov_sub, active_ids, chi2 / dof if dof > 0 else redchi2_sub)

            for i in to_deactivate:
                active[i] = False

    for sig in frange(sigma_min, sigma_max, sigma_step):
        for shift in frange(-shift_max, shift_max, shift_step):
            cont0, cont1, amps, cov, active_ids, redchi2 = constrained_fit_for_grid(sig, shift)
            if redchi2 < best_redchi2:
                best = (cont0, cont1, amps, sig, shift, active_ids)
                best_cov = cov
                best_redchi2 = redchi2

    if best is None:
        return BlendMeasurement(group_id, ",".join(line_ids), c_lo, c_hi, len(idx_line), len(idx_cont), trap_flux, trap_err, trap_snr, float("nan"), float("nan"), float("nan"), float("nan"), "")

    cont0, cont1, amps, sigma_a, _shift, active_ids = best
    component_fluxes = [amp * SQRT2PI * sigma_a for amp in amps]
    gauss_flux_sum = sum(component_fluxes)
    comp_text = ",".join(f"{lid}:{val:.3e}" for lid, val in zip(line_ids, component_fluxes))

    gauss_flux_err = float("nan")
    p = len(line_ids)
    if best_cov is not None:
        var_amp_sum = 0.0
        ok = True
        # Covariance only exists for active amplitudes in this constrained fit.
        active_pos = {line_i: k for k, line_i in enumerate(active_ids)}
        for i in range(p):
            for j in range(p):
                if i not in active_pos or j not in active_pos:
                    continue
                try:
                    var_amp_sum += best_cov[2 + active_pos[i]][2 + active_pos[j]]
                except Exception:
                    ok = False
        if ok:
            var = (SQRT2PI * sigma_a) ** 2 * var_amp_sum
            if var > 0:
                gauss_flux_err = math.sqrt(var)

    gauss_snr = gauss_flux_sum / gauss_flux_err if (math.isfinite(gauss_flux_err) and gauss_flux_err > 0) else float("nan")

    return BlendMeasurement(
        group_id=group_id,
        member_ids=",".join(line_ids),
        center_lo_a=c_lo,
        center_hi_a=c_hi,
        n_line_pts=len(idx_line),
        n_cont_pts=len(idx_cont),
        trap_flux=trap_flux,
        trap_err=trap_err,
        trap_snr=trap_snr,
        gauss_flux_sum=gauss_flux_sum,
        gauss_flux_err=gauss_flux_err,
        gauss_snr=gauss_snr,
        redchi2=best_redchi2,
        component_fluxes=comp_text,
    )


def mark_blends(rows: list[LineMeasurement]) -> None:
    in_range = [r for r in rows if r.in_range]
    in_range.sort(key=lambda r: r.obs_a)
    for i, r in enumerate(in_range):
        neighbors: list[str] = []
        for j, o in enumerate(in_range):
            if i == j:
                continue
            overlap = min(r.line_hi_a, o.line_hi_a) - max(r.line_lo_a, o.line_lo_a)
            if overlap > 0:
                neighbors.append(o.line_id)
        if neighbors:
            r.blend_flag = True
            r.blend_neighbors = ",".join(neighbors)


def fmt(x: float) -> str:
    return "nan" if not math.isfinite(x) else f"{x:.3e}"


def combine_with_fixed_ratio(
    f1: float, e1: float, f2: float, e2: float, ratio_f2_over_f1: float
) -> tuple[float, float, float, float, float]:
    """Return constrained estimates for (f1, f2) under f2 = ratio * f1."""
    if not (math.isfinite(f1) and math.isfinite(f2) and math.isfinite(e1) and math.isfinite(e2) and e1 > 0 and e2 > 0):
        return float("nan"), float("nan"), float("nan"), float("nan"), float("nan")

    w1 = 1.0 / (e1 * e1)
    w2 = 1.0 / (e2 * e2)
    denom = w1 + ratio_f2_over_f1 * ratio_f2_over_f1 * w2
    if denom <= 0:
        return float("nan"), float("nan"), float("nan"), float("nan"), float("nan")

    f1_hat = (w1 * f1 + ratio_f2_over_f1 * w2 * f2) / denom
    e1_hat = math.sqrt(1.0 / denom)
    f2_hat = ratio_f2_over_f1 * f1_hat
    e2_hat = ratio_f2_over_f1 * e1_hat
    total = f1_hat + f2_hat
    etot = math.sqrt(e1_hat * e1_hat + e2_hat * e2_hat)
    return f1_hat, e1_hat, f2_hat, e2_hat, total / etot if etot > 0 else float("nan")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spectrum-json", type=Path, required=True)
    ap.add_argument("--z", type=float, required=True)
    ap.add_argument("--output-json", type=Path, default=None)
    ap.add_argument("--snr-threshold", type=float, default=3.0)
    args = ap.parse_args()

    if args.output_json is None:
        stem = args.spectrum_json.stem
        z_tag = f"{args.z:.3f}".replace(".", "p")
        args.output_json = args.spectrum_json.with_name(f"{stem}_lineflux_z{z_tag}.json")

    spec = read_spectrum(args.spectrum_json)
    if not spec.wave_a:
        payload = {
            "meta": {
                "spectrum_json": str(args.spectrum_json),
                "z": args.z,
                "status": "no_valid_samples",
                "snr_threshold": args.snr_threshold,
                "units": {
                    "wavelength": "A",
                    "flux": "erg/s/cm^2",
                },
            },
            "physics_constraints": {
                "oiii_5008_over_4960": R_OIII_5008_4960,
                "siii_9533_over_9071": R_SIII_9533_9071,
                "unresolved_complexes": ["halpha+nii_6585+sii_6725"],
            },
            "individual_lines": [],
            "blend_groups": [],
            "physics_constrained_results": {},
        }
        if args.output_json is not None:
            args.output_json.parent.mkdir(parents=True, exist_ok=True)
            args.output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            print(f"json={args.output_json}")
        else:
            print(json.dumps(payload, indent=2))
        return 0

    rows = [measure_one_line(spec, line_id, name, rest_um, args.z) for line_id, name, rest_um in EMISSION_LINES]
    mark_blends(rows)
    blend_rows = [measure_blend_group(spec, gid, members, args.z) for gid, members in BLEND_GROUPS]
    by_id = {r.line_id: r for r in rows}
    blend_by_id = {b.group_id: b for b in blend_rows}

    det_trap = [
        r for r in rows
        if r.in_range and math.isfinite(r.trap_snr) and r.trap_snr >= args.snr_threshold and r.trap_flux > 0
    ]
    det_trap.sort(key=lambda r: r.trap_snr, reverse=True)

    det_robust = [
        r for r in rows
        if r.in_range
        and math.isfinite(r.trap_snr)
        and math.isfinite(r.gauss_snr)
        and r.trap_snr >= args.snr_threshold
        and r.gauss_snr >= args.snr_threshold
        and r.trap_flux > 0
        and r.gauss_flux > 0
    ]
    unresolved_ids = {"halpha", "nii_6585", "sii_6725", "oiii_4960", "oiii_5008"}
    det_robust = [r for r in det_robust if r.line_id not in unresolved_ids]
    det_robust.sort(key=lambda r: min(r.trap_snr, r.gauss_snr), reverse=True)

    # Physics-constrained summary:
    # 1) [OIII]5008/4960 fixed
    o3_4960 = by_id.get("oiii_4960")
    o3_5008 = by_id.get("oiii_5008")
    o3_trap = PhysicsConstraintResult("OIII_doublet_trap", float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"))
    o3_gauss = PhysicsConstraintResult("OIII_doublet_gauss", float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"))
    if o3_4960 is not None and o3_5008 is not None:
        f4960_t, e4960_t, f5008_t, e5008_t, snr_t = combine_with_fixed_ratio(
            o3_4960.trap_flux, o3_4960.trap_err, o3_5008.trap_flux, o3_5008.trap_err, R_OIII_5008_4960
        )
        o3_trap = PhysicsConstraintResult(
            "OIII_doublet_trap",
            f4960_t + f5008_t,
            math.sqrt(e4960_t * e4960_t + e5008_t * e5008_t) if math.isfinite(e4960_t) and math.isfinite(e5008_t) else float("nan"),
            snr_t,
            float("nan"),
            float("nan"),
            float("nan"),
        )
        f4960_g, e4960_g, f5008_g, e5008_g, snr_g = combine_with_fixed_ratio(
            o3_4960.gauss_flux, o3_4960.gauss_err, o3_5008.gauss_flux, o3_5008.gauss_err, R_OIII_5008_4960
        )
        o3_gauss = PhysicsConstraintResult(
            "OIII_doublet_gauss",
            f4960_g + f5008_g,
            math.sqrt(e4960_g * e4960_g + e5008_g * e5008_g) if math.isfinite(e4960_g) and math.isfinite(e5008_g) else float("nan"),
            snr_g,
            float("nan"),
            float("nan"),
            float("nan"),
        )

    # 2) [SIII]9533/9071 fixed
    s3_9071 = by_id.get("siii_9071")
    s3_9533 = by_id.get("siii_9533")
    s3_trap = PhysicsConstraintResult("SIII_doublet_trap", float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"))
    s3_gauss = PhysicsConstraintResult("SIII_doublet_gauss", float("nan"), float("nan"), float("nan"), float("nan"), float("nan"), float("nan"))
    if s3_9071 is not None and s3_9533 is not None:
        f9071_t, e9071_t, f9533_t, e9533_t, snr_t = combine_with_fixed_ratio(
            s3_9071.trap_flux, s3_9071.trap_err, s3_9533.trap_flux, s3_9533.trap_err, R_SIII_9533_9071
        )
        s3_trap = PhysicsConstraintResult(
            "SIII_doublet_trap",
            f9071_t + f9533_t,
            math.sqrt(e9071_t * e9071_t + e9533_t * e9533_t) if math.isfinite(e9071_t) and math.isfinite(e9533_t) else float("nan"),
            snr_t,
            float("nan"),
            float("nan"),
            float("nan"),
        )
        f9071_g, e9071_g, f9533_g, e9533_g, snr_g = combine_with_fixed_ratio(
            s3_9071.gauss_flux, s3_9071.gauss_err, s3_9533.gauss_flux, s3_9533.gauss_err, R_SIII_9533_9071
        )
        s3_gauss = PhysicsConstraintResult(
            "SIII_doublet_gauss",
            f9071_g + f9533_g,
            math.sqrt(e9071_g * e9071_g + e9533_g * e9533_g) if math.isfinite(e9071_g) and math.isfinite(e9533_g) else float("nan"),
            snr_g,
            float("nan"),
            float("nan"),
            float("nan"),
        )

    # 3) unresolved Halpha + NII (+SII in same complex): report total complex only
    ha_complex = blend_by_id.get("ha_nii_sii")

    if args.output_json is not None:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "meta": {
                "spectrum_json": str(args.spectrum_json),
                "z": args.z,
                "wavelength_range_A": [spec.wave_a[0], spec.wave_a[-1]],
                "snr_threshold": args.snr_threshold,
                "units": {
                    "wavelength": "A",
                    "flux": "erg/s/cm^2",
                },
            },
            "physics_constraints": {
                "oiii_5008_over_4960": R_OIII_5008_4960,
                "siii_9533_over_9071": R_SIII_9533_9071,
                "unresolved_complexes": ["halpha+nii_6585+sii_6725"],
            },
            "individual_lines": [
                {
                    "line_id": r.line_id,
                    "line_name": r.line_name,
                    "rest_um": r.rest_um,
                    "obs_A": r.obs_a,
                    "n_line_pts": r.n_line_pts,
                    "n_cont_pts": r.n_cont_pts,
                    "line_window_A": [r.line_lo_a, r.line_hi_a],
                    "trap_flux": r.trap_flux if math.isfinite(r.trap_flux) else None,
                    "trap_err": r.trap_err if math.isfinite(r.trap_err) else None,
                    "trap_snr": r.trap_snr if math.isfinite(r.trap_snr) else None,
                    "gauss_flux": r.gauss_flux if math.isfinite(r.gauss_flux) else None,
                    "gauss_err": r.gauss_err if math.isfinite(r.gauss_err) else None,
                    "gauss_snr": r.gauss_snr if math.isfinite(r.gauss_snr) else None,
                    "gauss_sigma_A": r.gauss_sigma_a if math.isfinite(r.gauss_sigma_a) else None,
                    "gauss_shift_A": r.gauss_shift_a if math.isfinite(r.gauss_shift_a) else None,
                    "redchi2": r.redchi2 if math.isfinite(r.redchi2) else None,
                    "blend_flag": r.blend_flag,
                    "blend_neighbors": r.blend_neighbors.split(",") if r.blend_neighbors else [],
                }
                for r in rows
                if r.in_range
            ],
            "blend_groups": [
                {
                    "group_id": b.group_id,
                    "member_ids": b.member_ids.split(","),
                    "center_range_A": [b.center_lo_a, b.center_hi_a],
                    "n_line_pts": b.n_line_pts,
                    "n_cont_pts": b.n_cont_pts,
                    "trap_flux": b.trap_flux if math.isfinite(b.trap_flux) else None,
                    "trap_err": b.trap_err if math.isfinite(b.trap_err) else None,
                    "trap_snr": b.trap_snr if math.isfinite(b.trap_snr) else None,
                    "gauss_flux_sum": b.gauss_flux_sum if math.isfinite(b.gauss_flux_sum) else None,
                    "gauss_flux_err": b.gauss_flux_err if math.isfinite(b.gauss_flux_err) else None,
                    "gauss_snr": b.gauss_snr if math.isfinite(b.gauss_snr) else None,
                    "redchi2": b.redchi2 if math.isfinite(b.redchi2) else None,
                    "component_fluxes": b.component_fluxes,
                }
                for b in blend_rows
            ],
            "physics_constrained_results": {
                "oiii_doublet_total": {
                    "trap_flux": o3_trap.trap_flux if math.isfinite(o3_trap.trap_flux) else None,
                    "trap_err": o3_trap.trap_err if math.isfinite(o3_trap.trap_err) else None,
                    "trap_snr": o3_trap.trap_snr if math.isfinite(o3_trap.trap_snr) else None,
                    "gauss_flux": o3_gauss.trap_flux if math.isfinite(o3_gauss.trap_flux) else None,
                    "gauss_err": o3_gauss.trap_err if math.isfinite(o3_gauss.trap_err) else None,
                    "gauss_snr": o3_gauss.trap_snr if math.isfinite(o3_gauss.trap_snr) else None,
                },
                "siii_doublet_total": {
                    "trap_flux": s3_trap.trap_flux if math.isfinite(s3_trap.trap_flux) else None,
                    "trap_err": s3_trap.trap_err if math.isfinite(s3_trap.trap_err) else None,
                    "trap_snr": s3_trap.trap_snr if math.isfinite(s3_trap.trap_snr) else None,
                    "gauss_flux": s3_gauss.trap_flux if math.isfinite(s3_gauss.trap_flux) else None,
                    "gauss_err": s3_gauss.trap_err if math.isfinite(s3_gauss.trap_err) else None,
                    "gauss_snr": s3_gauss.trap_snr if math.isfinite(s3_gauss.trap_snr) else None,
                },
                "unresolved_halpha_nii_sii_complex": {
                    "trap_flux": ha_complex.trap_flux if (ha_complex is not None and math.isfinite(ha_complex.trap_flux)) else None,
                    "trap_err": ha_complex.trap_err if (ha_complex is not None and math.isfinite(ha_complex.trap_err)) else None,
                    "trap_snr": ha_complex.trap_snr if (ha_complex is not None and math.isfinite(ha_complex.trap_snr)) else None,
                    "gauss_flux": ha_complex.gauss_flux_sum if (ha_complex is not None and math.isfinite(ha_complex.gauss_flux_sum)) else None,
                    "gauss_err": ha_complex.gauss_flux_err if (ha_complex is not None and math.isfinite(ha_complex.gauss_flux_err)) else None,
                    "gauss_snr": ha_complex.gauss_snr if (ha_complex is not None and math.isfinite(ha_complex.gauss_snr)) else None,
                },
            },
        }
        args.output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    in_range_count = sum(1 for r in rows if r.in_range)
    finite_count = sum(1 for r in rows if r.in_range and math.isfinite(r.trap_snr))
    print(f"spectrum={args.spectrum_json}")
    print(f"z={args.z:.5f}")
    print(f"wavelength_range_A={spec.wave_a[0]:.1f}..{spec.wave_a[-1]:.1f}")
    print(f"lines_in_range={in_range_count} measured={finite_count}")

    print("\ncredible_detections_trapezoid:")
    if not det_trap:
        print("  none")
    else:
        for r in det_trap:
            blend_note = " (blend)" if r.blend_flag else ""
            print(
                f"  {r.line_id:12s} obs={r.obs_a:8.1f}A "
                f"trap={fmt(r.trap_flux)}±{fmt(r.trap_err)} snr={r.trap_snr:5.1f} "
                f"gauss={fmt(r.gauss_flux)}±{fmt(r.gauss_err)} snr={r.gauss_snr:5.1f}{blend_note}"
            )

    print("\ncredible_detections_robust_per_line (trap>=3, gauss>=3, both positive):")
    if not det_robust:
        print("  none")
    else:
        for r in det_robust:
            blend_note = " (blend)" if r.blend_flag else ""
            print(
                f"  {r.line_id:12s} obs={r.obs_a:8.1f}A "
                f"trap={fmt(r.trap_flux)}±{fmt(r.trap_err)} snr={r.trap_snr:5.1f} "
                f"gauss={fmt(r.gauss_flux)}±{fmt(r.gauss_err)} snr={r.gauss_snr:5.1f}{blend_note}"
            )

    print("\nphysics_constrained_results:")
    print(
        f"  [OIII]4960+5008 (5008/4960={R_OIII_5008_4960:.2f}) "
        f"trap_total={fmt(o3_trap.trap_flux)} snr={o3_trap.trap_snr:5.1f} "
        f"gauss_total={fmt(o3_gauss.trap_flux)} snr={o3_gauss.trap_snr:5.1f}"
    )
    print(
        f"  [SIII]9071+9533 (9533/9071={R_SIII_9533_9071:.2f}) "
        f"trap_total={fmt(s3_trap.trap_flux)} snr={s3_trap.trap_snr:5.1f} "
        f"gauss_total={fmt(s3_gauss.trap_flux)} snr={s3_gauss.trap_snr:5.1f}"
    )
    if ha_complex is not None:
        print(
            "  unresolved Halpha+[NII]+[SII] complex "
            f"trap_total={fmt(ha_complex.trap_flux)} snr={ha_complex.trap_snr:5.1f} "
            f"gauss_total={fmt(ha_complex.gauss_flux_sum)} snr={ha_complex.gauss_snr:5.1f}"
        )

    print("\nblend_group_fits:")
    for b in blend_rows:
        det = (
            math.isfinite(b.trap_snr)
            and math.isfinite(b.gauss_snr)
            and b.trap_snr >= args.snr_threshold
            and b.gauss_snr >= args.snr_threshold
            and b.trap_flux > 0
            and b.gauss_flux_sum > 0
        )
        tag = "DETECT" if det else "-"
        print(
            f"  {b.group_id:16s} {tag:6s} "
            f"trap={fmt(b.trap_flux)}±{fmt(b.trap_err)} snr={b.trap_snr:5.1f} "
            f"gauss_sum={fmt(b.gauss_flux_sum)}±{fmt(b.gauss_flux_err)} snr={b.gauss_snr:5.1f} "
            f"redchi2={b.redchi2:6.2f}"
        )
        if b.component_fluxes:
            print(f"    components: {b.component_fluxes}")

    print("\nall_in_range_summary:")
    for r in [x for x in rows if x.in_range]:
        status = "DETECT" if (math.isfinite(r.trap_snr) and r.trap_snr >= args.snr_threshold and r.trap_flux > 0) else "-"
        blend = "blend" if r.blend_flag else ""
        print(f"  {r.line_id:12s} {status:6s} obs={r.obs_a:8.1f}A trap_snr={r.trap_snr:6.2f} gauss_snr={r.gauss_snr:6.2f} {blend}")

    if args.output_json is not None:
        print(f"\njson={args.output_json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
