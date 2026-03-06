"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { withBasePathForApiUrl } from "@/lib/base-path";
import type { TargetRecord } from "@/lib/schemas";

type SortField = "name" | "z_spec" | "status" | "priority" | "assets";

type FilterState = {
  query: string;
  status: string;
  priority: string;
  zMin: string;
  zMax: string;
  coneRa: string;
  coneDec: string;
  coneRadiusArcsec: string;
};

const DEFAULT_FILTERS: FilterState = {
  query: "",
  status: "all",
  priority: "all",
  zMin: "",
  zMax: "",
  coneRa: "",
  coneDec: "",
  coneRadiusArcsec: "2"
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function normalizedZSpec(value: number): number {
  return Math.abs(value - 1) < 1e-9 ? -1 : value;
}

function formatZSpec(value: number): string {
  const normalized = normalizedZSpec(value);
  return normalized === -1 ? "-1" : normalized.toFixed(2);
}

function angularSeparationArcsec(raDeg1: number, decDeg1: number, raDeg2: number, decDeg2: number): number {
  const ra1 = toRadians(raDeg1);
  const dec1 = toRadians(decDeg1);
  const ra2 = toRadians(raDeg2);
  const dec2 = toRadians(decDeg2);

  const sinD1 = Math.sin(dec1);
  const sinD2 = Math.sin(dec2);
  const cosD1 = Math.cos(dec1);
  const cosD2 = Math.cos(dec2);
  const cosDeltaRa = Math.cos(ra1 - ra2);

  const cosAngle = Math.min(1, Math.max(-1, sinD1 * sinD2 + cosD1 * cosD2 * cosDeltaRa));
  const angleRad = Math.acos(cosAngle);
  return (angleRad * 180 * 3600) / Math.PI;
}

function commentTags(notes: string): string[] {
  return notes
    .split(/[;,/|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (item.length > 28 ? `${item.slice(0, 28)}...` : item))
    .slice(0, 3);
}

function firstImagePreview(target: TargetRecord): string | null {
  for (const asset of target.ancillary_assets) {
    if (asset.asset_type === "image" && asset.preview_url) {
      return withBasePathForApiUrl(asset.preview_url);
    }
  }
  return null;
}

function jadesNumericId(name: string): string | null {
  const match = name.match(/^JADES-(\d+)$/);
  return match ? match[1] : null;
}

export function PortalTargetTable({ targets }: { targets: TargetRecord[] }) {
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = appliedFilters.query.trim().toLowerCase();
    const zMinNum = appliedFilters.zMin.trim() === "" ? null : Number(appliedFilters.zMin);
    const zMaxNum = appliedFilters.zMax.trim() === "" ? null : Number(appliedFilters.zMax);

    let rows = targets.filter((target) => {
      if (appliedFilters.status !== "all" && target.status !== appliedFilters.status) return false;
      if (appliedFilters.priority !== "all" && target.priority !== appliedFilters.priority) return false;
      if (zMinNum !== null && Number.isFinite(zMinNum) && normalizedZSpec(target.z_spec) < zMinNum) return false;
      if (zMaxNum !== null && Number.isFinite(zMaxNum) && normalizedZSpec(target.z_spec) > zMaxNum) return false;
      if (!q) return true;
      return target.emerald_id.toLowerCase().includes(q) || target.name.toLowerCase().includes(q);
    });

    const hasConeRa = appliedFilters.coneRa.trim() !== "";
    const hasConeDec = appliedFilters.coneDec.trim() !== "";
    const raNum = Number(appliedFilters.coneRa);
    const decNum = Number(appliedFilters.coneDec);
    const radiusNum = Number(appliedFilters.coneRadiusArcsec || "2");
    const coneEnabled =
      hasConeRa &&
      hasConeDec &&
      Number.isFinite(raNum) &&
      Number.isFinite(decNum) &&
      Number.isFinite(radiusNum) &&
      radiusNum > 0;

    if (coneEnabled) {
      let best: TargetRecord | null = null;
      let bestSep = Number.POSITIVE_INFINITY;

      for (const target of rows) {
        const sep = angularSeparationArcsec(raNum, decNum, target.ra, target.dec);
        if (sep < bestSep) {
          bestSep = sep;
          best = target;
        }
      }

      if (best && bestSep <= radiusNum) {
        rows = [best];
      } else {
        rows = [];
      }
    }

    return rows.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      if (sortField === "z_spec") {
        return (normalizedZSpec(a.z_spec) - normalizedZSpec(b.z_spec)) * dir;
      }
      if (sortField === "assets") {
        return (a.ancillary_assets.length - b.ancillary_assets.length) * dir;
      }

      return String(a[sortField]).localeCompare(String(b[sortField])) * dir;
    });
  }, [targets, appliedFilters, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const currentRows = filtered.slice(start, start + pageSize);

  function toggleSort(nextField: SortField) {
    if (sortField === nextField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(nextField);
    setSortDirection("asc");
  }

  function sortGlyph(field: SortField): string {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function applySelection() {
    setAppliedFilters(draftFilters);
    setPage(1);
  }

  function clearSelection() {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSortField("name");
    setSortDirection("asc");
    setPageSize(25);
    setPage(1);
  }

  return (
    <div className="grid">
      <section className="card grid grid-2">
        <label>
          Search by JADES ID / target ID
          <input
            value={draftFilters.query}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, query: event.target.value }));
            }}
            placeholder="JADES-1008580 or EMR-8580"
          />
        </label>
        <label>
          Status
          <select
            value={draftFilters.status}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, status: event.target.value }));
            }}
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="observed">Observed</option>
            <option value="processed">Processed</option>
          </select>
        </label>
        <label>
          Priority
          <select
            value={draftFilters.priority}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, priority: event.target.value }));
            }}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          z_spec min
          <input
            type="number"
            step="0.01"
            value={draftFilters.zMin}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, zMin: event.target.value }));
            }}
            placeholder="4.0"
          />
        </label>
        <label>
          z_spec max
          <input
            type="number"
            step="0.01"
            value={draftFilters.zMax}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, zMax: event.target.value }));
            }}
            placeholder="9.0"
          />
        </label>
      </section>

      <section className="card grid grid-2">
        <label>
          Cone Search RA (deg)
          <input
            type="number"
            step="0.000001"
            value={draftFilters.coneRa}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, coneRa: event.target.value }));
            }}
            placeholder="189.3391498"
          />
        </label>
        <label>
          Cone Search Dec (deg)
          <input
            type="number"
            step="0.000001"
            value={draftFilters.coneDec}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, coneDec: event.target.value }));
            }}
            placeholder="62.2845893"
          />
        </label>
        <label>
          Radius (arcsec)
          <input
            type="number"
            step="0.1"
            value={draftFilters.coneRadiusArcsec}
            onChange={(event) => {
              setDraftFilters((prev) => ({ ...prev, coneRadiusArcsec: event.target.value }));
            }}
            placeholder="2"
          />
        </label>
      </section>

      <section className="card">
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
          <button type="button" onClick={applySelection}>
            Submit Selection
          </button>
          <button type="button" className="secondary" onClick={clearSelection}>
            Clear Selection
          </button>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="muted">Rows</span>
            <select
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              style={{ width: "auto" }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
        <p className="muted">{filtered.length} matching targets</p>
        <table>
          <thead>
            <tr>
              <th>
                <button onClick={() => toggleSort("name")}>JADES ID {sortGlyph("name")}</button>
              </th>
              <th>
                <button onClick={() => toggleSort("z_spec")}>z_spec {sortGlyph("z_spec")}</button>
              </th>
              <th>
                <button onClick={() => toggleSort("status")}>Status {sortGlyph("status")}</button>
              </th>
              <th>
                <button onClick={() => toggleSort("priority")}>Priority {sortGlyph("priority")}</button>
              </th>
              <th>Comment</th>
              <th>FitsMap</th>
              <th>
                <button onClick={() => toggleSort("assets")}>Assets {sortGlyph("assets")}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((target) => {
              const tags = commentTags(target.notes);
              const preview = firstImagePreview(target);
              const jadesId = jadesNumericId(target.name);
              return (
                <tr key={target.emerald_id}>
                  <td>
                    <span className="jades-cell">
                      <Link href={`/portal/targets/${target.emerald_id}`}>{target.name}</Link>
                      {jadesId ? (
                        <a
                          href={`https://jades.idies.jhu.edu/goods-n/goodsn_eazy_seds_v10e1/${jadesId}_EAZY_SED.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="muted"
                          style={{ fontSize: "0.78rem" }}
                        >
                          JADES EAZY SED
                        </a>
                      ) : (
                        <small className="muted" style={{ fontSize: "0.78rem" }}>
                          JADES EAZY SED
                        </small>
                      )}
                      {preview ? (
                        <span className="hover-preview" role="tooltip">
                          <Image src={preview} alt={`${target.name} preview`} width={300} height={300} unoptimized />
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td>{formatZSpec(target.z_spec)}</td>
                  <td>
                    <span className="tag">{target.status}</span>
                  </td>
                  <td>{target.priority}</td>
                  <td>
                    {tags.length > 0 ? (
                      <div style={{ display: "flex", gap: "0.28rem", flexWrap: "wrap" }}>
                        {tags.map((tag) => (
                          <span key={`${target.emerald_id}-${tag}`} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    <a
                      href={`https://jades.idies.jhu.edu/goods-n/?ra=${target.ra}&dec=${target.dec}&zoom=11`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      FitsMap
                    </a>
                  </td>
                  <td>{target.ancillary_assets.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.8rem" }}>
          <button
            className="secondary"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {safePage} / {totalPages}
          </span>
          <button
            className="secondary"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
