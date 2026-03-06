"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";

type SpectrumAssetOption = {
  storageKey: string;
  label: string;
};

type SpectrumResponse = {
  meta: {
    source_id: string;
    observation_number: string;
    wavelength_unit: string;
    flux_unit: string;
    flux_error_unit: string;
    schema_version: number;
  };
  spectrum: {
    wavelength: number[];
    flux: number[];
    flux_error: number[];
  };
  templates: unknown[];
};

declare global {
  interface Window {
    Plotly?: {
      newPlot: (root: HTMLElement, data: unknown[], layout: unknown, config: unknown) => Promise<unknown>;
      react: (root: HTMLElement, data: unknown[], layout: unknown, config: unknown) => Promise<unknown>;
      purge: (root: HTMLElement) => void;
      relayout: (root: HTMLElement, layout: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

const PLOTLY_CDN = "https://cdn.plot.ly/plotly-2.35.2.min.js";

let plotlyScriptPromise: Promise<void> | null = null;

function ensurePlotlyLoaded(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.Plotly) {
    return Promise.resolve();
  }
  if (plotlyScriptPromise) {
    return plotlyScriptPromise;
  }

  plotlyScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLOTLY_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Plotly")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = PLOTLY_CDN;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Plotly"));
    document.head.appendChild(script);
  });

  return plotlyScriptPromise;
}

export function Spectrum1DViewer({ assets }: { assets: SpectrumAssetOption[] }) {
  const [selectedKey, setSelectedKey] = useState(assets[0]?.storageKey ?? "");
  const [payload, setPayload] = useState<SpectrumResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plotReady, setPlotReady] = useState(false);
  const plotRef = useRef<HTMLDivElement | null>(null);

  const selectedAssetLabel = useMemo(
    () => assets.find((asset) => asset.storageKey === selectedKey)?.label ?? "",
    [assets, selectedKey]
  );

  useEffect(() => {
    if (!selectedKey) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPlotReady(false);
      try {
        const response = await fetch(
          `${withBasePath("/api/spectra/1d")}?key=${encodeURIComponent(selectedKey)}`
        );
        const next = (await response.json()) as SpectrumResponse & { error?: string };
        if (!response.ok) {
          throw new Error(next.error || "Unable to load spectrum");
        }
        if (!cancelled) {
          setPayload(next);
        }
      } catch (err) {
        if (!cancelled) {
          setPayload(null);
          setError(err instanceof Error ? err.message : "Unexpected error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  useEffect(() => {
    if (!payload || !plotRef.current) {
      return;
    }
    let cancelled = false;
    const currentPayload = payload;
    const root = plotRef.current;

    async function render() {
      try {
        await ensurePlotlyLoaded();
        if (cancelled || !window.Plotly || !root) return;

        const x = currentPayload.spectrum.wavelength;
        const y = currentPayload.spectrum.flux;
        const yerr = currentPayload.spectrum.flux_error;

        const traces = [
          {
            x,
            y,
            type: "scatter",
            mode: "lines",
            name: "Flux",
            line: { color: "#0f8f6f", width: 1.7 },
            hovertemplate: "lambda=%{x:.5f} um<br>flux=%{y:.5e} Jy<extra></extra>"
          },
          {
            x,
            y,
            type: "scatter",
            mode: "markers",
            marker: { size: 2.5, color: "#1aa781", opacity: 0.55 },
            name: "Samples",
            visible: "legendonly",
            hovertemplate: "lambda=%{x:.5f} um<br>flux=%{y:.5e} Jy<extra></extra>"
          },
          {
            x,
            y,
            type: "scatter",
            mode: "lines",
            line: { width: 0 },
            showlegend: false,
            hoverinfo: "skip"
          },
          {
            x,
            y: y.map((value, i) => value + yerr[i]),
            type: "scatter",
            mode: "lines",
            line: { width: 0 },
            fill: "tonexty",
            fillcolor: "rgba(15,143,111,0.15)",
            name: "Flux + 1sigma",
            hoverinfo: "skip"
          },
          {
            x,
            y: y.map((value, i) => value - yerr[i]),
            type: "scatter",
            mode: "lines",
            line: { width: 0 },
            fill: "tonexty",
            fillcolor: "rgba(15,143,111,0.15)",
            name: "Flux - 1sigma",
            hoverinfo: "skip",
            showlegend: false
          }
        ];

        const layout = {
          title: `${selectedAssetLabel || "PRISM x1d"} (JADES-${currentPayload.meta.source_id})`,
          margin: { t: 52, r: 18, b: 52, l: 72 },
          paper_bgcolor: "#ffffff",
          plot_bgcolor: "#fbfffd",
          xaxis: {
            title: `Wavelength (${currentPayload.meta.wavelength_unit})`,
            gridcolor: "#d8ece6",
            zeroline: false
          },
          yaxis: {
            title: `Flux (${currentPayload.meta.flux_unit})`,
            gridcolor: "#d8ece6",
            zeroline: false
          },
          legend: { orientation: "h", y: 1.16, x: 0 }
        };

        const config = {
          responsive: true,
          displaylogo: false,
          scrollZoom: true,
          modeBarButtonsToAdd: ["drawline", "drawopenpath", "eraseshape"]
        };

        await window.Plotly.react(root, traces, layout, config);
        if (!cancelled) {
          setPlotReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to render plot");
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      if (root && window.Plotly) {
        window.Plotly.purge(root);
      }
    };
  }, [payload, selectedAssetLabel]);

  function resetAxes() {
    if (!plotRef.current || !window.Plotly) return;
    void window.Plotly.relayout(plotRef.current, {
      "xaxis.autorange": true,
      "yaxis.autorange": true
    });
  }

  return (
    <section className="card">
      <h2>Interactive 1D Spectrum</h2>
      <p className="muted">
        Drag to zoom, pan, and inspect narrow features. This viewer is ready for future
        template overlays and interactive comparison tools.
      </p>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ minWidth: "320px", flex: "1 1 320px" }}>
          x1d file
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            style={{ marginTop: "0.2rem" }}
          >
            {assets.map((asset) => (
              <option key={asset.storageKey} value={asset.storageKey}>
                {asset.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" onClick={resetAxes} disabled={!plotReady}>
          Reset Axes
        </button>
      </div>

      {loading ? <p className="muted">Loading spectrum...</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <div
        ref={plotRef}
        style={{
          width: "100%",
          minHeight: "460px",
          border: "1px solid #cbe6de",
          borderRadius: "10px",
          background: "#fff"
        }}
      />
    </section>
  );
}
