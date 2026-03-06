"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";

type SpectrumAssetOption = {
  storageKey: string;
  label: string;
};

type EmissionLine = {
  id: string;
  name: string;
  restUm: number;
  color: string;
  priority?: number;
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
const EMISSION_LINES: EmissionLine[] = [
  { id: "lya_1216", name: "Lyα", restUm: 0.121567, color: "rgba(206,76,47,0.45)" },
  { id: "civ_1549", name: "[C IV]", restUm: 0.154948, color: "rgba(222,110,64,0.45)" },
  { id: "niv_1486", name: "N IV]", restUm: 0.148650, color: "rgba(216,102,58,0.45)" },
  { id: "heii_1640", name: "He II", restUm: 0.164042, color: "rgba(224,120,70,0.45)" },
  { id: "oiii_1661", name: "O III]", restUm: 0.166081, color: "rgba(224,132,75,0.45)" },
  { id: "oiii_1666", name: "O III]", restUm: 0.166615, color: "rgba(218,141,83,0.45)" },
  { id: "ciii_1908", name: "[C III]", restUm: 0.190873, color: "rgba(227,143,63,0.45)" },
  { id: "mgii_2799", name: "Mg II", restUm: 0.279912, color: "rgba(210,151,67,0.42)" },
  { id: "oii_3729", name: "[O II]", restUm: 0.37285, color: "rgba(182,120,54,0.42)" },
  { id: "neiii_3869", name: "[Ne III]", restUm: 0.386876, color: "rgba(170,128,71,0.42)" },
  { id: "neiii_3968", name: "[Ne III]", restUm: 0.396747, color: "rgba(167,136,82,0.42)" },
  { id: "hdelta", name: "Hδ", restUm: 0.410289, color: "rgba(139,137,165,0.42)" },
  { id: "hbeta", name: "Hβ", restUm: 0.486267, color: "rgba(67,149,179,0.42)" },
  { id: "oiii_4960", name: "[O III]", restUm: 0.4960295, color: "rgba(63,171,181,0.42)", priority: 1 },
  { id: "oiii_5008", name: "[O III]", restUm: 0.500824, color: "rgba(41,178,155,0.42)", priority: 2 },
  { id: "hei_5876", name: "He I", restUm: 0.587562, color: "rgba(77,162,124,0.42)" },
  { id: "halpha", name: "Hα", restUm: 0.656461, color: "rgba(54,164,91,0.45)", priority: 2 },
  { id: "nii_6585", name: "[N II]", restUm: 0.658527, color: "rgba(96,175,100,0.42)", priority: 1 },
  { id: "sii_6725", name: "[S II]", restUm: 0.672548, color: "rgba(114,182,116,0.42)" },
  { id: "hgamma", name: "Hγ", restUm: 0.434168, color: "rgba(79,109,200,0.42)", priority: 2 },
  { id: "oiii_4363", name: "[O III]", restUm: 0.436334, color: "rgba(64,127,205,0.42)", priority: 1 },
  { id: "siii_9071", name: "[S III]", restUm: 0.90711, color: "rgba(121,107,204,0.42)" },
  { id: "siii_9533", name: "[S III]", restUm: 0.953321, color: "rgba(122,94,191,0.42)" },
  { id: "padelta", name: "Paδ", restUm: 1.00521, color: "rgba(141,99,198,0.42)" },
  { id: "hei_10833", name: "He I", restUm: 1.08333, color: "rgba(147,89,196,0.42)" },
  { id: "pagamma", name: "Paγ", restUm: 1.0941, color: "rgba(159,92,204,0.42)" },
  { id: "feii_12570", name: "[Fe II]", restUm: 1.25702, color: "rgba(168,97,194,0.42)" },
  { id: "pabeta", name: "Paβ", restUm: 1.28215, color: "rgba(173,103,188,0.42)" },
  { id: "feii_16440", name: "[Fe II]", restUm: 1.64405, color: "rgba(179,112,181,0.42)" },
  { id: "paalpha", name: "Paα", restUm: 1.8756, color: "rgba(184,120,172,0.42)" },
  { id: "hei_20592", name: "He I", restUm: 2.05925, color: "rgba(191,130,167,0.42)" },
  { id: "h2_21224", name: "H₂", restUm: 2.12238, color: "rgba(180,109,142,0.42)" },
  { id: "brgamma", name: "Brγ", restUm: 2.1661, color: "rgba(194,126,131,0.42)" },
  { id: "h2_24073", name: "H₂", restUm: 2.40726, color: "rgba(204,123,111,0.42)" },
  { id: "h2_24244", name: "H₂", restUm: 2.42436, color: "rgba(206,129,101,0.42)" },
  { id: "brbeta", name: "Brβ", restUm: 2.62584, color: "rgba(211,131,89,0.42)" },
  { id: "h2_28033", name: "H₂", restUm: 2.80326, color: "rgba(214,137,77,0.42)" },
  { id: "pah_32900", name: "PAH", restUm: 3.29, color: "rgba(219,147,72,0.42)" },
  { id: "pf8", name: "Pf8", restUm: 3.74052, color: "rgba(225,157,69,0.42)" },
  { id: "bralpha", name: "Brα", restUm: 4.05223, color: "rgba(233,168,68,0.42)" }
];

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

function normalizeZSpec(value: number): number {
  return Math.abs(value - 1) < 1e-9 || Math.abs(value) < 1e-9 ? -1 : value;
}

function roundRedshift(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function formatLineLabel(line: EmissionLine): string {
  if (line.restUm > 1) {
    return `${line.name} ${Number(line.restUm.toPrecision(4))}`;
  }
  return `${line.name} ${Number((line.restUm * 1e4).toPrecision(4))}`;
}

export function Spectrum1DViewer({ assets, zSpec }: { assets: SpectrumAssetOption[]; zSpec: number }) {
  const [selectedKey, setSelectedKey] = useState(assets[0]?.storageKey ?? "");
  const [payload, setPayload] = useState<SpectrumResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(EMISSION_LINES.map((line) => line.id));
  const [templateZ, setTemplateZ] = useState(0);
  const [templateObservedAnchor, setTemplateObservedAnchor] = useState<number | null>(null);
  const [templateObservedLineName, setTemplateObservedLineName] = useState<string>("");
  const [zInput, setZInput] = useState("0");
  const plotRef = useRef<HTMLDivElement | null>(null);
  const templateZRef = useRef(0);
  const templateLineByShapeIndexRef = useRef<Map<number, EmissionLine>>(new Map());
  const suppressRelayoutRef = useRef(false);
  const normalizedZ = normalizeZSpec(zSpec);
  const hasKnownRedshift = Number.isFinite(normalizedZ) && normalizedZ > 0;

  const selectedAssetLabel = useMemo(
    () => assets.find((asset) => asset.storageKey === selectedKey)?.label ?? "",
    [assets, selectedKey]
  );

  useEffect(() => {
    const initialZ = hasKnownRedshift ? roundRedshift(normalizedZ) : 0;
    setTemplateZ(initialZ);
    setZInput(initialZ.toFixed(4));
    setTemplateObservedAnchor(null);
    setTemplateObservedLineName("");
  }, [hasKnownRedshift, normalizedZ, selectedKey]);

  useEffect(() => {
    templateZRef.current = templateZ;
  }, [templateZ]);

  const applyTemplatePositions = useCallback((nextZ: number) => {
    if (!plotRef.current || !window.Plotly) return;
    const updates: Record<string, number> = {};
    for (const [shapeIndex, line] of templateLineByShapeIndexRef.current.entries()) {
      const nextX = line.restUm * (1 + nextZ);
      updates[`shapes[${shapeIndex}].x0`] = nextX;
      updates[`shapes[${shapeIndex}].x1`] = nextX;
      updates[`annotations[${shapeIndex}].x`] = nextX;
    }
    if (Object.keys(updates).length === 0) {
      return;
    }
    suppressRelayoutRef.current = true;
    void window.Plotly.relayout(plotRef.current, updates).finally(() => {
      suppressRelayoutRef.current = false;
    });
  }, []);

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

        const xMin = x.length > 0 ? Math.min(...x) : 0;
        const xMax = x.length > 0 ? Math.max(...x) : 0;
        const yMin = y.length > 0 ? Math.min(...y) : 0;
        const yMax = y.length > 0 ? Math.max(...y) : 1;
        const overlayZ = templateZRef.current;
        const canShowOverlay = showLines && Number.isFinite(overlayZ) && overlayZ > -0.999;

        const visibleLines = canShowOverlay
          ? EMISSION_LINES.filter((line) => selectedLineIds.includes(line.id))
              .map((line) => ({ line, obsUm: line.restUm * (1 + overlayZ) }))
              .filter(({ obsUm }) => obsUm >= xMin && obsUm <= xMax)
              .sort(
                (a, b) =>
                  (a.line.priority ?? 0) - (b.line.priority ?? 0) ||
                  a.line.restUm - b.line.restUm
              )
          : [];

        const templateLineByShapeIndex = new Map<number, EmissionLine>();
        const lineShapes = visibleLines.map(({ line, obsUm }, index) => {
          const shapeIndex = index;
          templateLineByShapeIndex.set(shapeIndex, line);
          return {
            type: "line",
            x0: obsUm,
            x1: obsUm,
            y0: yMin,
            y1: yMax,
            line: {
              color: line.color,
              width: 2.2,
              dash: "solid"
            }
          };
        });
        templateLineByShapeIndexRef.current = templateLineByShapeIndex;

        const lineAnnotations = visibleLines.map(({ line, obsUm }) => ({
          x: obsUm,
          y: 0.95,
          yref: "paper",
          yanchor: "top",
          text: `<span style="text-shadow:-2px -2px 0 #fff,2px -2px 0 #fff,-2px 2px 0 #fff,2px 2px 0 #fff">${formatLineLabel(line)}</span>`,
          textangle: -90,
          showarrow: false,
          font: { size: 11, color: "#2d4340" }
        }));

        const layout = {
          title: {
            text: `${selectedAssetLabel || "PRISM x1d"} (JADES-${currentPayload.meta.source_id})`,
            y: 0.975
          },
          margin: { t: 86, r: 18, b: 52, l: 72 },
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
          legend: { orientation: "h", y: 1.03, x: 0 },
          shapes: lineShapes,
          annotations: lineAnnotations
        };

        const config = {
          responsive: true,
          displaylogo: false,
          scrollZoom: true,
          editable: false,
          edits: { shapePosition: true },
          modeBarButtonsToAdd: ["drawline", "drawopenpath", "eraseshape"]
        };

        await window.Plotly.react(root, traces, layout, config);
        const graphDiv = root as unknown as {
          on?: (name: string, handler: (event: Record<string, unknown>) => void) => void;
          removeAllListeners?: (name: string) => void;
        };
        if (graphDiv.removeAllListeners) {
          graphDiv.removeAllListeners("plotly_relayout");
          graphDiv.removeAllListeners("plotly_relayouting");
        }
        const handleTemplateDragEvent = (eventData: Record<string, unknown>) => {
            if (suppressRelayoutRef.current) {
              return;
            }
            const templateMap = templateLineByShapeIndexRef.current;
            if (templateMap.size === 0) return;

            let movedLine: EmissionLine | null = null;
            let nextObserved = Number.NaN;

            for (const [key, raw] of Object.entries(eventData)) {
              const match = key.match(/^shapes\[(\d+)\]\.x[01]$/);
              if (!match) continue;
              const shapeIndex = Number(match[1]);
              if (!Number.isFinite(shapeIndex)) continue;
              const line = templateMap.get(shapeIndex);
              if (!line) continue;
              const observed = typeof raw === "number" ? raw : Number(raw);
              if (!Number.isFinite(observed)) continue;
              movedLine = line;
              nextObserved = observed;
              break;
            }

            if (!movedLine || !Number.isFinite(nextObserved)) return;
            const nextZ = roundRedshift(nextObserved / movedLine.restUm - 1);
            if (!Number.isFinite(nextZ)) return;
            applyTemplatePositions(nextZ);
            setTemplateObservedLineName(movedLine.name);
            setTemplateObservedAnchor(nextObserved);
            setTemplateZ(nextZ);
            setZInput(nextZ.toFixed(4));
        };
        if (graphDiv.on) {
          graphDiv.on("plotly_relayouting", handleTemplateDragEvent);
          graphDiv.on("plotly_relayout", handleTemplateDragEvent);
        }
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
  }, [
    payload,
    applyTemplatePositions,
    selectedAssetLabel,
    selectedLineIds,
    showLines
  ]);

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

      <section className="card" style={{ background: "#f9fffc", boxShadow: "none" }}>
        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted">Emission lines at z={templateZ.toFixed(4)}</span>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="checkbox"
              checked={showLines}
              onChange={(event) => setShowLines(event.target.checked)}
              style={{ width: "auto" }}
            />
            Show lines
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => setSelectedLineIds(EMISSION_LINES.map((line) => line.id))}
          >
            Select all
          </button>
          <button type="button" className="secondary" onClick={() => setSelectedLineIds([])}>
            Clear
          </button>
        </div>
        <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.55rem 0.9rem" }}>
          {EMISSION_LINES.map((line) => {
            const checked = selectedLineIds.includes(line.id);
            return (
              <label key={line.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedLineIds((prev) => (prev.includes(line.id) ? prev : [...prev, line.id]));
                      return;
                    }
                    setSelectedLineIds((prev) => prev.filter((id) => id !== line.id));
                  }}
                  style={{ width: "auto" }}
                />
                <span className="tag" style={{ borderColor: "#b6d8cc", background: "#eefaf5" }}>
                  {formatLineLabel(line)}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ background: "#f7fbff", boxShadow: "none" }}>
        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
          <strong>Redshift Measure Tool</strong>
          <span className="tag" style={{ background: "#eef4ff", borderColor: "#cad8ff" }}>
            z_template = {templateZ.toFixed(4)}
          </span>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            Input z
            <input
              type="number"
              step="0.0001"
              value={zInput}
              onChange={(event) => {
                const raw = event.target.value;
                setZInput(raw);
                const parsed = Number(raw);
                if (Number.isFinite(parsed)) {
                  const rounded = roundRedshift(parsed);
                  applyTemplatePositions(rounded);
                  setTemplateZ(rounded);
                  setZInput(rounded.toFixed(4));
                  setTemplateObservedAnchor(null);
                  setTemplateObservedLineName("");
                }
              }}
              style={{ width: "120px" }}
            />
          </label>
          {templateObservedAnchor !== null ? (
            <span className="tag" style={{ background: "#eef4ff", borderColor: "#cad8ff" }}>
              {templateObservedLineName || "line"} obs λ = {templateObservedAnchor.toFixed(5)} um
            </span>
          ) : null}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Left-drag any displayed emission line to update redshift in real time.
        </p>
      </section>

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
