"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Spectrum1DViewer } from "@/components/spectrum-1d-viewer";
import { withBasePath } from "@/lib/base-path";
import type { SpectraSourceEntry } from "./page";

/** Haversine angular distance in degrees */
function angularDistDeg(
  ra1: number, dec1: number,
  ra2: number, dec2: number
): number {
  const d2r = Math.PI / 180;
  const dDec = (dec2 - dec1) * d2r;
  const dRa  = (ra2  - ra1)  * d2r;
  const a =
    Math.sin(dDec / 2) ** 2 +
    Math.cos(dec1 * d2r) * Math.cos(dec2 * d2r) * Math.sin(dRa / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(a))) / d2r;
}

export function SpectraBrowser({
  sources,
  defaultEmeraldId,
  allTags,
}: {
  sources: SpectraSourceEntry[];
  defaultEmeraldId: string;
  allTags: string[];
}) {
  const [liveSources, setLiveSources] = useState(sources);
  const [selectedId, setSelectedId] = useState(defaultEmeraldId);
  const [search, setSearch]         = useState("");
  const [tagFilter, setTagFilter]   = useState<string[]>([]);
  const [coneRa, setConeRa]         = useState("");
  const [coneDec, setConeDec]       = useState("");
  const [coneRadius, setConeRadius] = useState("30");
  const [coneEnabled, setConeEnabled] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLiveSources(sources);
  }, [sources]);

  const filteredSources = useMemo(() => {
    let result = liveSources;

    // 1. Text search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.emeraldId.toLowerCase().includes(q)
      );
    }

    // 2. Tag filter (AND – source must have every selected tag)
    if (tagFilter.length > 0) {
      result = result.filter((s) =>
        tagFilter.every(
          (tag) =>
            s.emissionLineTags.includes(tag) || s.quickTags.includes(tag)
        )
      );
    }

    // 3. Cone search
    if (coneEnabled) {
      const ra     = parseFloat(coneRa);
      const dec    = parseFloat(coneDec);
      const radius = parseFloat(coneRadius);
      if (
        Number.isFinite(ra) && Number.isFinite(dec) &&
        Number.isFinite(radius) && radius > 0
      ) {
        const radiusDeg = radius / 3600;
        result = result.filter((s) => {
          if (s.ra === 0 && s.dec === 0) return false;
          return angularDistDeg(ra, dec, s.ra, s.dec) <= radiusDeg;
        });
      }
    }

    return result;
  }, [liveSources, search, tagFilter, coneEnabled, coneRa, coneDec, coneRadius]);

  function toggleTag(tag: string) {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const selectedSource =
    liveSources.find((s) => s.emeraldId === selectedId) ?? liveSources[0] ?? null;

  const filteredIndex = filteredSources.findIndex(
    (s) => s.emeraldId === selectedId
  );

  function selectSource(id: string) {
    setSelectedId(id);
    // scroll to that item in the sidebar
    setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-emerald-id="${id}"]`
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 0);
  }

  function goNext() {
    if (filteredSources.length === 0) return;
    const next =
      filteredIndex >= 0
        ? filteredSources[(filteredIndex + 1) % filteredSources.length]
        : filteredSources[0];
    if (next) selectSource(next.emeraldId);
  }

  function goPrev() {
    if (filteredSources.length === 0) return;
    const prev =
      filteredIndex > 0
        ? filteredSources[filteredIndex - 1]
        : filteredSources[filteredSources.length - 1];
    if (prev) selectSource(prev.emeraldId);
  }

  return (
    <div className="spectra-browser">
      {/* ── Sidebar ── */}
      <aside className="spectra-browser__sidebar card">
        <div className="spectra-browser__sidebar-header">
          <strong>Sources</strong>
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            {filteredSources.length} / {liveSources.length}
          </span>
        </div>

        {/* Text search */}
        <input
          type="search"
          placeholder="Search by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Tag filter */}
        {allTags.length > 0 && (
          <details className="spectra-browser__filter-section">
            <summary className="spectra-browser__filter-summary">
              Tag Filter
              {tagFilter.length > 0 && (
                <span className="tag" style={{ marginLeft: "0.4rem", fontSize: "0.72rem" }}>
                  {tagFilter.length} active
                </span>
              )}
            </summary>
            <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={tagFilter.includes(tag) ? "spectra-browser__tag-btn--on" : "secondary spectra-browser__tag-btn"}
                >
                  {tag}
                </button>
              ))}
            </div>
            {tagFilter.length > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setTagFilter([])}
                style={{ marginTop: "0.4rem", width: "100%", fontSize: "0.78rem" }}
              >
                Clear tags
              </button>
            )}
          </details>
        )}

        {/* Cone search */}
        <details className="spectra-browser__filter-section">
          <summary className="spectra-browser__filter-summary">
            Cone Search
            {coneEnabled && (
              <span className="tag" style={{ marginLeft: "0.4rem", fontSize: "0.72rem", background: "#eef4ff", borderColor: "#cad8ff" }}>
                on
              </span>
            )}
          </summary>
          <div style={{ marginTop: "0.4rem", display: "grid", gap: "0.35rem" }}>
            <label style={{ fontSize: "0.82rem" }}>
              RA (deg)
              <input type="number" step="0.0001" placeholder="e.g. 189.20" value={coneRa} onChange={(e) => setConeRa(e.target.value)} />
            </label>
            <label style={{ fontSize: "0.82rem" }}>
              Dec (deg)
              <input type="number" step="0.0001" placeholder="e.g. 62.24" value={coneDec} onChange={(e) => setConeDec(e.target.value)} />
            </label>
            <label style={{ fontSize: "0.82rem" }}>
              Radius (arcsec)
              <input type="number" min="1" step="1" value={coneRadius} onChange={(e) => setConeRadius(e.target.value)} />
            </label>
            <button
              type="button"
              onClick={() => setConeEnabled((v) => !v)}
              className={coneEnabled ? "" : "secondary"}
              style={{ fontSize: "0.82rem" }}
            >
              {coneEnabled ? "Disable Cone Search" : "Apply Cone Search"}
            </button>
          </div>
        </details>

        {/* Source list */}
        <div className="spectra-browser__source-list" ref={listRef}>
          {filteredSources.length === 0 && (
            <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              No sources match.
            </p>
          )}
          {filteredSources.map((s) => {
            const active = s.emeraldId === selectedId;
            return (
              <button
                key={s.emeraldId}
                type="button"
                data-emerald-id={s.emeraldId}
                onClick={() => selectSource(s.emeraldId)}
                className={
                  active
                    ? "spectra-browser__source-item spectra-browser__source-item--active"
                    : "spectra-browser__source-item secondary"
                }
              >
                <span className="spectra-browser__source-name">{s.name}</span>
                <span className="muted" style={{ fontSize: "0.75rem", lineHeight: 1.2 }}>
                  {s.emeraldId}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div className="spectra-browser__main">
        {/* Source header + navigation */}
        <div className="card spectra-browser__source-header" style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "nowrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#114b3f", whiteSpace: "nowrap" }}>
              {selectedSource?.name ?? "—"}
            </h2>
            <span className="muted" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
              {selectedSource?.emeraldId}
            </span>
            {selectedSource && (
              <span className="tag" style={{ whiteSpace: "nowrap" }}>
                z_spec ={" "}
                {Math.abs((selectedSource.zSpec ?? 1) - 1) < 1e-9
                  ? "—"
                  : selectedSource.zSpec.toFixed(3)}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="secondary"
              onClick={goPrev}
              disabled={filteredSources.length === 0}
              style={{ whiteSpace: "nowrap" }}
            >
              ← Prev
            </button>
            <button
              type="button"
              className="secondary"
              onClick={goNext}
              disabled={filteredSources.length === 0}
              style={{ whiteSpace: "nowrap" }}
            >
              Next →
            </button>
            {filteredIndex >= 0 && (
              <span className="muted" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                {filteredIndex + 1} / {filteredSources.length}
              </span>
            )}
            {selectedSource && (
              <Link
                href={withBasePath(`/portal/targets/${selectedSource.emeraldId}`)}
                style={{ fontSize: "0.85rem", padding: "0.38rem 0.75rem",
                  borderRadius: "10px", border: "1px solid #9fd6c5",
                  background: "#f1fbf7", color: "#137c61", textDecoration: "none", whiteSpace: "nowrap" }}
              >
                View Detail →
              </Link>
            )}
        </div>

        {/* Spectrum viewer */}
        {selectedSource ? (
          selectedSource.assets.length > 0 ? (
            <Spectrum1DViewer
              key={selectedSource.emeraldId}
              assets={selectedSource.assets}
              zSpec={selectedSource.zSpec}
              sourceName={selectedSource.name}
              emeraldId={selectedSource.emeraldId}
              onSubmittedRedshift={(nextZ) => {
                setLiveSources((prev) =>
                  prev.map((source) =>
                    source.emeraldId === selectedSource.emeraldId
                      ? { ...source, zSpec: nextZ }
                      : source
                  )
                );
              }}
            />
          ) : (
            <div className="card">
              <p className="muted">
                No 1D spectrum assets available for {selectedSource.name}.
              </p>
            </div>
          )
        ) : (
          <div className="card">
            <p className="muted">Select a source from the list.</p>
          </div>
        )}
      </div>
    </div>
  );
}
