#!/usr/bin/env python3
"""Measure emission-line fluxes from a prism x1d JSON spectrum.

Outputs both:
- Continuum-subtracted trapezoidal flux
- Gaussian-model flux (single line or multi-line blend)

No third-party dependencies are required.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

C_CGS = 2.99792458e10
JY_TO_CGS = 1e-23

REST_LINES_A = {
    "Hbeta": 4862.68,
    "[OIII]4960": 4960.30,
    "[OIII]5008": 5008.24,
    "Halpha": 6564.61,
}


@dataclass
class Spectrum:
    wave_a: list[float]
    flux_flam: list[float]
    err_flam: list[float]


@dataclass
class Region:
    name: str
    line_lo_a: float
    line_hi_a: float
    cont_left_lo_a: float
    cont_left_hi_a: float
    cont_right_lo_a: float
    cont_right_hi_a: float


@dataclass
class FitResult:
    continuum_a: float
    continuum_b: float
    coeffs: list[float]
    chi2: float
    sigma_a: float
    delta_a: float


def jy_to_flam_a(flux_jy: float, wave_um: float) -> float:
    wave_cm = wave_um * 1e-4
    if wave_cm <= 0:
        return float("nan")
    # F_lambda[erg s^-1 cm^-2 A^-1] = F_nu * c / lambda^2 * (1e-8 A/cm)
    return flux_jy * JY_TO_CGS * C_CGS / (wave_cm * wave_cm) * 1e-8


def read_spectrum(path: Path) -> Spectrum:
    payload = json.loads(path.read_text(encoding="utf-8"))
    w_um = payload["spectrum"]["wavelength"]
    f_jy = payload["spectrum"]["flux"]
    e_jy = payload["spectrum"]["flux_error"]

    wave_a: list[float] = []
    flux_flam: list[float] = []
    err_flam: list[float] = []

    n = min(len(w_um), len(f_jy), len(e_jy))
    for i in range(n):
        wu = float(w_um[i])
        fj = float(f_jy[i])
        ej = float(e_jy[i])
        wa = wu * 1e4
        ff = jy_to_flam_a(fj, wu)
        ef = jy_to_flam_a(abs(ej), wu)
        if not (math.isfinite(wa) and math.isfinite(ff) and math.isfinite(ef) and ef > 0):
            continue
        wave_a.append(wa)
        flux_flam.append(ff)
        err_flam.append(ef)

    order = sorted(range(len(wave_a)), key=lambda i: wave_a[i])
    return Spectrum(
        wave_a=[wave_a[i] for i in order],
        flux_flam=[flux_flam[i] for i in order],
        err_flam=[err_flam[i] for i in order],
    )


def select_indices(wave_a: list[float], lo: float, hi: float) -> list[int]:
    return [i for i, w in enumerate(wave_a) if lo <= w <= hi]


def weighted_linear_fit(x: list[float], y: list[float], w: list[float]) -> tuple[float, float]:
    sw = sum(w)
    if sw == 0:
        return 0.0, 0.0
    sx = sum(wi * xi for wi, xi in zip(w, x))
    sy = sum(wi * yi for wi, yi in zip(w, y))
    sxx = sum(wi * xi * xi for wi, xi in zip(w, x))
    sxy = sum(wi * xi * yi for wi, xi, yi in zip(w, x, y))
    denom = sw * sxx - sx * sx
    if abs(denom) < 1e-30:
        a = sy / sw
        b = 0.0
    else:
        b = (sw * sxy - sx * sy) / denom
        a = (sy - b * sx) / sw
    return a, b


def solve_linear_system(a: list[list[float]], b: list[float]) -> list[float]:
    n = len(b)
    aug = [row[:] + [b[i]] for i, row in enumerate(a)]

    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < 1e-30:
            return [0.0] * n
        aug[col], aug[pivot] = aug[pivot], aug[col]

        piv = aug[col][col]
        for j in range(col, n + 1):
            aug[col][j] /= piv

        for r in range(n):
            if r == col:
                continue
            fac = aug[r][col]
            for j in range(col, n + 1):
                aug[r][j] -= fac * aug[col][j]

    return [aug[i][n] for i in range(n)]


def linear_least_squares(design_rows: list[list[float]], y: list[float], sigma: list[float]) -> tuple[list[float], float]:
    p = len(design_rows[0])
    ata = [[0.0 for _ in range(p)] for _ in range(p)]
    atb = [0.0 for _ in range(p)]

    for row, yi, si in zip(design_rows, y, sigma):
        wi = 1.0 / (si * si)
        for i in range(p):
            atb[i] += wi * row[i] * yi
            for j in range(p):
                ata[i][j] += wi * row[i] * row[j]

    coeffs = solve_linear_system(ata, atb)

    chi2 = 0.0
    for row, yi, si in zip(design_rows, y, sigma):
        model = sum(ci * ri for ci, ri in zip(coeffs, row))
        r = (yi - model) / si
        chi2 += r * r
    return coeffs, chi2


def continuum_from_sidebands(spec: Spectrum, region: Region) -> tuple[float, float]:
    idx_l = select_indices(spec.wave_a, region.cont_left_lo_a, region.cont_left_hi_a)
    idx_r = select_indices(spec.wave_a, region.cont_right_lo_a, region.cont_right_hi_a)
    idx = idx_l + idx_r
    if len(idx) < 3:
        return 0.0, 0.0

    x = [spec.wave_a[i] for i in idx]
    y = [spec.flux_flam[i] for i in idx]
    w = [1.0 / (spec.err_flam[i] * spec.err_flam[i]) for i in idx]
    return weighted_linear_fit(x, y, w)


def trapz_integral(x: list[float], y: list[float]) -> float:
    if len(x) < 2:
        return 0.0
    total = 0.0
    for i in range(len(x) - 1):
        dx = x[i + 1] - x[i]
        total += 0.5 * dx * (y[i + 1] + y[i])
    return total


def trapz_err(x: list[float], sigma: list[float]) -> float:
    if len(x) < 2:
        return 0.0
    # Conservative bin-by-bin quadrature using local bin widths.
    var = 0.0
    for i in range(len(x) - 1):
        dx = x[i + 1] - x[i]
        s = 0.5 * dx * math.sqrt(sigma[i] * sigma[i] + sigma[i + 1] * sigma[i + 1])
        var += s * s
    return math.sqrt(var)


def measure_trapezoid(spec: Spectrum, region: Region) -> tuple[float, float, int]:
    a, b = continuum_from_sidebands(spec, region)
    idx = select_indices(spec.wave_a, region.line_lo_a, region.line_hi_a)
    x = [spec.wave_a[i] for i in idx]
    y = [spec.flux_flam[i] - (a + b * spec.wave_a[i]) for i in idx]
    e = [spec.err_flam[i] for i in idx]
    return trapz_integral(x, y), trapz_err(x, e), len(idx)


def gaussian(x: float, mu: float, sigma: float) -> float:
    z = (x - mu) / sigma
    return math.exp(-0.5 * z * z)


def iter_grid(start: float, stop: float, step: float) -> Iterable[float]:
    n = int(round((stop - start) / step))
    for i in range(n + 1):
        yield start + i * step


def fit_multi_gaussian(
    spec: Spectrum,
    region: Region,
    centers_a: list[float],
    sigma_min_a: float,
    sigma_max_a: float,
    sigma_step_a: float,
    delta_min_a: float,
    delta_max_a: float,
    delta_step_a: float,
) -> tuple[FitResult, list[int]]:
    idx = select_indices(spec.wave_a, region.line_lo_a, region.line_hi_a)
    x = [spec.wave_a[i] for i in idx]
    y = [spec.flux_flam[i] for i in idx]
    s = [spec.err_flam[i] for i in idx]

    x0 = sum(x) / len(x)
    best = FitResult(0.0, 0.0, [0.0] * len(centers_a), float("inf"), sigma_min_a, 0.0)

    for sigma_a in iter_grid(sigma_min_a, sigma_max_a, sigma_step_a):
        if sigma_a <= 0:
            continue
        for delta_a in iter_grid(delta_min_a, delta_max_a, delta_step_a):
            design: list[list[float]] = []
            for xi in x:
                row = [1.0, xi - x0]
                for c in centers_a:
                    row.append(gaussian(xi, c + delta_a, sigma_a))
                design.append(row)

            coeffs, chi2 = linear_least_squares(design, y, s)
            if chi2 < best.chi2:
                best = FitResult(
                    continuum_a=coeffs[0],
                    continuum_b=coeffs[1],
                    coeffs=coeffs[2:],
                    chi2=chi2,
                    sigma_a=sigma_a,
                    delta_a=delta_a,
                )

    best.continuum_b = best.continuum_b
    return best, idx


def fit_single_gaussian(
    spec: Spectrum,
    region: Region,
    center_a: float,
    sigma_min_a: float,
    sigma_max_a: float,
    sigma_step_a: float,
    delta_min_a: float,
    delta_max_a: float,
    delta_step_a: float,
) -> tuple[FitResult, list[int]]:
    fit, idx = fit_multi_gaussian(
        spec,
        region,
        [center_a],
        sigma_min_a,
        sigma_max_a,
        sigma_step_a,
        delta_min_a,
        delta_max_a,
        delta_step_a,
    )
    return fit, idx


def fmt(x: float) -> str:
    return f"{x:.3e}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure line fluxes from prism x1d JSON")
    parser.add_argument("--spectrum-json", type=Path, required=True)
    parser.add_argument("--z", type=float, required=True)
    args = parser.parse_args()

    spec = read_spectrum(args.spectrum_json)
    z = args.z

    hb = REST_LINES_A["Hbeta"] * (1.0 + z)
    o3a = REST_LINES_A["[OIII]4960"] * (1.0 + z)
    o3b = REST_LINES_A["[OIII]5008"] * (1.0 + z)
    ha = REST_LINES_A["Halpha"] * (1.0 + z)

    blend = Region(
        name="Hbeta+[OIII]",
        line_lo_a=hb - 320.0,
        line_hi_a=o3b + 320.0,
        cont_left_lo_a=hb - 950.0,
        cont_left_hi_a=hb - 420.0,
        cont_right_lo_a=o3b + 420.0,
        cont_right_hi_a=o3b + 950.0,
    )
    halpha = Region(
        name="Halpha",
        line_lo_a=ha - 620.0,
        line_hi_a=ha + 620.0,
        cont_left_lo_a=ha - 1500.0,
        cont_left_hi_a=ha - 700.0,
        cont_right_lo_a=ha + 700.0,
        cont_right_hi_a=ha + 1500.0,
    )

    tb_flux, tb_err, tb_n = measure_trapezoid(spec, blend)
    th_flux, th_err, th_n = measure_trapezoid(spec, halpha)

    blend_fit, blend_idx = fit_multi_gaussian(
        spec,
        blend,
        [hb, o3a, o3b],
        sigma_min_a=50.0,
        sigma_max_a=260.0,
        sigma_step_a=2.0,
        delta_min_a=-80.0,
        delta_max_a=80.0,
        delta_step_a=2.0,
    )
    ha_fit, ha_idx = fit_single_gaussian(
        spec,
        halpha,
        ha,
        sigma_min_a=50.0,
        sigma_max_a=260.0,
        sigma_step_a=2.0,
        delta_min_a=-100.0,
        delta_max_a=100.0,
        delta_step_a=2.0,
    )

    sqrt2pi = math.sqrt(2.0 * math.pi)
    hb_g = blend_fit.coeffs[0] * sqrt2pi * blend_fit.sigma_a
    o3a_g = blend_fit.coeffs[1] * sqrt2pi * blend_fit.sigma_a
    o3b_g = blend_fit.coeffs[2] * sqrt2pi * blend_fit.sigma_a
    blend_g = hb_g + o3a_g + o3b_g
    ha_g = ha_fit.coeffs[0] * sqrt2pi * ha_fit.sigma_a

    print(f"spectrum={args.spectrum_json}")
    print(f"z={z:.5f}")
    print("observed_centers_A:")
    print(f"  Hbeta={hb:.1f}  [OIII]4960={o3a:.1f}  [OIII]5008={o3b:.1f}  Halpha={ha:.1f}")

    print()
    print("trapezoid_fluxes_erg_s_cm2:")
    print(f"  Hbeta+[OIII] window_flux={fmt(tb_flux)} +/- {fmt(tb_err)} (n={tb_n})")
    print(f"  Halpha        window_flux={fmt(th_flux)} +/- {fmt(th_err)} (n={th_n})")

    print()
    print("gaussian_fluxes_erg_s_cm2:")
    print(
        "  Hbeta+[OIII] total="
        f"{fmt(blend_g)}  (Hbeta={fmt(hb_g)}, [OIII]4960={fmt(o3a_g)}, [OIII]5008={fmt(o3b_g)})"
    )
    print(
        "  Hbeta+[OIII] fit_params: "
        f"sigma={blend_fit.sigma_a:.1f}A delta={blend_fit.delta_a:+.1f}A chi2={blend_fit.chi2:.2f} n={len(blend_idx)}"
    )
    print(f"  Halpha total={fmt(ha_g)}")
    print(
        "  Halpha fit_params: "
        f"sigma={ha_fit.sigma_a:.1f}A delta={ha_fit.delta_a:+.1f}A chi2={ha_fit.chi2:.2f} n={len(ha_idx)}"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
