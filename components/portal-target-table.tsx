"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { withBasePathForApiUrl } from "@/lib/base-path";
import type { TargetRecord } from "@/lib/schemas";
import { getEmissionLineTagsForTarget, getQuickTagsForTarget } from "@/lib/target-tags";

type SortField = "name" | "z_spec" | "status" | "instrument" | "priority" | "assets";

type FilterState = {
  query: string;
  quickTagQuery: string;
  emissionTagQuery: string;
  status: string;
  instrumentQuery: string;
  priority: string;
  zMin: string;
  zMax: string;
  coneRa: string;
  coneDec: string;
  coneRadiusArcsec: string;
};

const DEFAULT_FILTERS: FilterState = {
  query: "",
  quickTagQuery: "",
  emissionTagQuery: "",
  status: "all",
  instrumentQuery: "",
  priority: "all",
  zMin: "",
  zMax: "",
  coneRa: "",
  coneDec: "",
  coneRadiusArcsec: "2"
};

const INSTRUMENT_OPTIONS = ["G140M/F070LP", "PRISM", "G395M/F290LP"] as const;
const MULTI_VALUE_DELIMITER = "\n";
const SORT_FIELDS: SortField[] = ["name", "z_spec", "status", "instrument", "priority", "assets"];
const PAGE_SIZE_OPTIONS = new Set([25, 50, 100]);

function parseSelectedTags(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(MULTI_VALUE_DELIMITER)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function encodeMultiValueForUrl(value: string): string {
  return parseSelectedTags(value).join(",");
}

function decodeMultiValueFromUrl(value: string | null): string {
  if (!value) {
    return "";
  }
  const normalized = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join(MULTI_VALUE_DELIMITER);
  return normalized;
}

function parseFilterStateFromUrl(searchParams: URLSearchParams): FilterState {
  return {
    query: searchParams.get("query") ?? "",
    quickTagQuery: decodeMultiValueFromUrl(searchParams.get("quickTags")),
    emissionTagQuery: decodeMultiValueFromUrl(searchParams.get("emissionTags")),
    status: searchParams.get("status") ?? "all",
    instrumentQuery: decodeMultiValueFromUrl(searchParams.get("instruments")),
    priority: searchParams.get("priority") ?? "all",
    zMin: searchParams.get("zMin") ?? "",
    zMax: searchParams.get("zMax") ?? "",
    coneRa: searchParams.get("coneRa") ?? "",
    coneDec: searchParams.get("coneDec") ?? "",
    coneRadiusArcsec: searchParams.get("coneRadiusArcsec") ?? DEFAULT_FILTERS.coneRadiusArcsec
  };
}

function buildSearchParamsFromState(
  nextFilters: FilterState,
  nextSortField: SortField,
  nextSortDirection: "asc" | "desc",
  nextPage: number,
  nextPageSize: number
): URLSearchParams {
  const params = new URLSearchParams();

  if (nextFilters.query.trim()) params.set("query", nextFilters.query.trim());
  if (nextFilters.status !== "all") params.set("status", nextFilters.status);
  if (nextFilters.priority !== "all") params.set("priority", nextFilters.priority);
  if (nextFilters.zMin.trim()) params.set("zMin", nextFilters.zMin.trim());
  if (nextFilters.zMax.trim()) params.set("zMax", nextFilters.zMax.trim());
  if (nextFilters.coneRa.trim()) params.set("coneRa", nextFilters.coneRa.trim());
  if (nextFilters.coneDec.trim()) params.set("coneDec", nextFilters.coneDec.trim());
  if (
    nextFilters.coneRadiusArcsec.trim() &&
    nextFilters.coneRadiusArcsec.trim() !== DEFAULT_FILTERS.coneRadiusArcsec
  ) {
    params.set("coneRadiusArcsec", nextFilters.coneRadiusArcsec.trim());
  }

  const quickTags = encodeMultiValueForUrl(nextFilters.quickTagQuery);
  if (quickTags) params.set("quickTags", quickTags);
  const emissionTags = encodeMultiValueForUrl(nextFilters.emissionTagQuery);
  if (emissionTags) params.set("emissionTags", emissionTags);
  const instruments = encodeMultiValueForUrl(nextFilters.instrumentQuery);
  if (instruments) params.set("instruments", instruments);

  if (nextSortField !== "name") params.set("sort", nextSortField);
  if (nextSortDirection !== "asc") params.set("dir", nextSortDirection);
  if (nextPageSize !== 25) params.set("pageSize", String(nextPageSize));
  if (nextPage > 1) params.set("page", String(nextPage));

  return params;
}

function toggleTagValue(currentValue: string, tag: string): string {
  const selected = parseSelectedTags(currentValue);
  const tagLower = tag.toLowerCase();
  const nextSelected = selected.some((item) => item.toLowerCase() === tagLower)
    ? selected.filter((item) => item.toLowerCase() !== tagLower)
    : [...selected, tag];
  return nextSelected.join(MULTI_VALUE_DELIMITER);
}

function matchesAllSelectedTags(targetTags: string[], selectedTags: string[]): boolean {
  if (selectedTags.length === 0) {
    return true;
  }

  return selectedTags.every((selectedTag) =>
    targetTags.some((targetTag) => targetTag.toLowerCase() === selectedTag.toLowerCase())
  );
}

function normalizedZSpec(value: number): number {
  return Math.abs(value - 1) < 1e-9 || Math.abs(value) < 1e-9 ? -1 : value;
}

function formatZSpec(value: number): string {
  const normalized = normalizedZSpec(value);
  return normalized === -1 ? "-1" : normalized.toFixed(2);
}

function normalizedRaDeltaDeg(delta: number): number {
  let wrapped = delta;
  while (wrapped > 180) wrapped -= 360;
  while (wrapped < -180) wrapped += 360;
  return wrapped;
}

function coneMetricSeparationArcsec(ra0Deg: number, dec0Deg: number, raDeg: number, decDeg: number): number {
  const deltaRaDeg = normalizedRaDeltaDeg(raDeg - ra0Deg);
  const deltaDecDeg = decDeg - dec0Deg;
  const cosDec0 = Math.cos((dec0Deg * Math.PI) / 180);
  const distanceDeg = Math.sqrt((deltaRaDeg * cosDec0) ** 2 + deltaDecDeg ** 2);
  return distanceDeg * 3600;
}

function firstImagePreview(target: TargetRecord): string | null {
  for (const asset of target.ancillary_assets) {
    if (asset.asset_type === "image" && asset.preview_url) {
      return withBasePathForApiUrl(asset.preview_url);
    }
  }
  return null;
}

function spectrumPreviewForInstrument(target: TargetRecord, instrument: string): string | null {
  const instrumentLower = instrument.toLowerCase();

  const preferredSpectrum = target.ancillary_assets.find((asset) => {
    if (asset.asset_type !== "spectrum" || !asset.preview_url) {
      return false;
    }
    const key = asset.storage_key.toLowerCase();
    if (instrumentLower === "g140m/f070lp") {
      return key.includes("diver_grating_plots/");
    }
    if (instrumentLower === "prism") {
      return key.includes("diver_prism_plots/");
    }
    return false;
  });

  if (preferredSpectrum?.preview_url) {
    return withBasePathForApiUrl(preferredSpectrum.preview_url);
  }

  const fallback = target.ancillary_assets.find(
    (asset) => asset.asset_type === "spectrum" && asset.preview_url
  );
  return fallback?.preview_url ? withBasePathForApiUrl(fallback.preview_url) : null;
}

function jadesNumericId(name: string): string | null {
  const match = name.match(/^JADES-(\d+)$/);
  return match ? match[1] : null;
}

function observationModesForDisplay(target: TargetRecord) {
  return target.observation_modes.length > 0
    ? target.observation_modes
    : target.instruments.map((instrument) => ({ instrument, status: target.status }));
}

function ExpandableMultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder
}: {
  options: readonly string[];
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
  placeholder: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = Math.min(Math.max(options.length, 4), 10);
  const summaryLabel = selectedValues.length > 0 ? selectedValues.join(", ") : placeholder;

  if (!expanded) {
    return (
      <select
        value="__summary__"
        onMouseDown={(event) => {
          event.preventDefault();
          setExpanded(true);
        }}
        onFocus={() => setExpanded(true)}
      >
        <option value="__summary__">{summaryLabel}</option>
      </select>
    );
  }

  return (
    <select
      multiple
      value={selectedValues}
      aria-label={placeholder}
      autoFocus
      onBlur={() => setExpanded(false)}
      onChange={(event) => {
        onChange(Array.from(event.target.selectedOptions, (option) => option.value));
      }}
      size={visibleRows}
      style={{ minHeight: "10rem" }}
    >
      {options.map((option) => {
        return (
          <option key={option} value={option}>
            {option}
          </option>
        );
      })}
    </select>
  );
}

export function PortalTargetTable({ targets }: { targets: TargetRecord[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageInput, setPageInput] = useState("1");
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

  useEffect(() => {
    const parsedFilters = parseFilterStateFromUrl(searchParams);
    const parsedSort = searchParams.get("sort");
    const parsedDirection = searchParams.get("dir");
    const parsedPage = Number(searchParams.get("page") ?? "1");
    const parsedPageSize = Number(searchParams.get("pageSize") ?? "25");

    const nextSortField: SortField =
      parsedSort && SORT_FIELDS.includes(parsedSort as SortField) ? (parsedSort as SortField) : "name";
    const nextSortDirection = parsedDirection === "desc" ? "desc" : "asc";
    const nextPageSize = PAGE_SIZE_OPTIONS.has(parsedPageSize) ? parsedPageSize : 25;
    const nextPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.trunc(parsedPage) : 1;

    setDraftFilters(parsedFilters);
    setAppliedFilters(parsedFilters);
    setSortField(nextSortField);
    setSortDirection(nextSortDirection);
    setPageSize(nextPageSize);
    setPage(nextPage);
    setPageInput(String(nextPage));
    setInitializedFromUrl(true);
  }, [searchParams]);

  const allQuickTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const target of targets) {
      for (const tag of getQuickTagsForTarget(target)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [targets]);

  const allEmissionTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const target of targets) {
      for (const tag of getEmissionLineTagsForTarget(target)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [targets]);

  const filtered = useMemo(() => {
    const q = appliedFilters.query.trim().toLowerCase();
    const selectedQuickTags = parseSelectedTags(appliedFilters.quickTagQuery);
    const selectedEmissionTags = parseSelectedTags(appliedFilters.emissionTagQuery);
    const selectedInstruments = parseSelectedTags(appliedFilters.instrumentQuery);
    const zMinNum = appliedFilters.zMin.trim() === "" ? null : Number(appliedFilters.zMin);
    const zMaxNum = appliedFilters.zMax.trim() === "" ? null : Number(appliedFilters.zMax);
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

    let rows: TargetRecord[];

    if (coneEnabled) {
      const coneMatches: Array<{ target: TargetRecord; separationArcsec: number }> = [];
      for (const target of targets) {
        const sep = coneMetricSeparationArcsec(raNum, decNum, target.ra, target.dec);
        if (sep <= radiusNum) {
          coneMatches.push({ target, separationArcsec: sep });
        }
      }
      rows = coneMatches
        .sort((a, b) => a.separationArcsec - b.separationArcsec || a.target.name.localeCompare(b.target.name))
        .map((match) => match.target);
    } else {
      rows = targets.filter((target) => {
        const quickTags = getQuickTagsForTarget(target);
        const emissionTags = getEmissionLineTagsForTarget(target);
        const observationModes = observationModesForDisplay(target);
        const relevantModes =
          selectedInstruments.length > 0
            ? observationModes.filter((mode) =>
                selectedInstruments.some(
                  (selectedInstrument) => selectedInstrument.toLowerCase() === mode.instrument.toLowerCase()
                )
              )
            : observationModes;
        if (appliedFilters.status !== "all" && !relevantModes.some((mode) => mode.status === appliedFilters.status)) {
          return false;
        }
        if (!matchesAllSelectedTags(target.instruments, selectedInstruments)) return false;
        if (appliedFilters.priority !== "all" && target.priority !== appliedFilters.priority) return false;
        if (zMinNum !== null && Number.isFinite(zMinNum) && normalizedZSpec(target.z_spec) < zMinNum) return false;
        if (zMaxNum !== null && Number.isFinite(zMaxNum) && normalizedZSpec(target.z_spec) > zMaxNum) return false;
        if (!matchesAllSelectedTags(quickTags, selectedQuickTags)) return false;
        if (!matchesAllSelectedTags(emissionTags, selectedEmissionTags)) return false;
        if (!q) return true;
        return (
          target.emerald_id.toLowerCase().includes(q) ||
          target.name.toLowerCase().includes(q) ||
          target.instrument.toLowerCase().includes(q) ||
          target.notes.toLowerCase().includes(q) ||
          quickTags.some((tag) => tag.toLowerCase().includes(q)) ||
          emissionTags.some((tag) => tag.toLowerCase().includes(q))
        );
      });
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

  useEffect(() => {
    setPageInput(String(safePage));
  }, [safePage]);

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

  useEffect(() => {
    if (!initializedFromUrl) {
      return;
    }
    const nextParams = buildSearchParamsFromState(
      appliedFilters,
      sortField,
      sortDirection,
      page,
      pageSize
    );
    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [
    initializedFromUrl,
    appliedFilters,
    sortField,
    sortDirection,
    page,
    pageSize,
    pathname,
    router,
    searchParams
  ]);

  function applySelection() {
    setAppliedFilters(draftFilters);
    setPage(1);
    setPageInput("1");
  }

  function clearSelection() {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setSortField("name");
    setSortDirection("asc");
    setPageSize(25);
    setPage(1);
    setPageInput("1");
    router.replace(pathname, { scroll: false });
  }

  function jumpToPage() {
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const nextPage = Math.max(1, Math.min(totalPages, Math.trunc(parsed)));
    setPage(nextPage);
    setPageInput(String(nextPage));
  }

  function setQuickTagFilter(tag: string) {
    const nextQuickTagQuery = toggleTagValue(appliedFilters.quickTagQuery, tag);
    setDraftFilters((prev) => ({ ...prev, quickTagQuery: nextQuickTagQuery }));
    setAppliedFilters((prev) => ({ ...prev, quickTagQuery: nextQuickTagQuery }));
    setPage(1);
    setPageInput("1");
  }

  function setEmissionTagFilter(tag: string) {
    const nextEmissionTagQuery = toggleTagValue(appliedFilters.emissionTagQuery, tag);
    setDraftFilters((prev) => ({ ...prev, emissionTagQuery: nextEmissionTagQuery }));
    setAppliedFilters((prev) => ({ ...prev, emissionTagQuery: nextEmissionTagQuery }));
    setPage(1);
    setPageInput("1");
  }

  function handleSelectionSubmitFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter") {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA") {
      return;
    }
    event.preventDefault();
    applySelection();
  }

  const selectedQuickTags = parseSelectedTags(appliedFilters.quickTagQuery);
  const selectedEmissionTags = parseSelectedTags(appliedFilters.emissionTagQuery);
  const selectedInstruments = parseSelectedTags(appliedFilters.instrumentQuery);
  const currentCatalogUrl = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  return (
    <div className="grid">
      <section className="card grid grid-2" onKeyDown={handleSelectionSubmitFromKeyboard}>
        <label>
          Search by JADES ID / target ID
          <input
            value={draftFilters.query}
            onChange={(event) => {
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, query: value }));
              setAppliedFilters((prev) => ({ ...prev, query: value }));
              setPage(1);
              setPageInput("1");
            }}
            placeholder="JADES-1008580 or EMR-8580"
          />
        </label>
        <label>
          Quick tag
          <input
            list="target-quick-tags"
            value={draftFilters.quickTagQuery}
            onChange={(event) => {
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, quickTagQuery: value }));
              setAppliedFilters((prev) => ({ ...prev, quickTagQuery: value }));
              setPage(1);
              setPageInput("1");
            }}
            placeholder="Select one or more"
          />
        </label>
        <label>
          Emission line tag
          <ExpandableMultiSelect
            options={allEmissionTags}
            selectedValues={parseSelectedTags(draftFilters.emissionTagQuery)}
            onChange={(nextValues) => {
              const nextValue = nextValues.join(MULTI_VALUE_DELIMITER);
              setDraftFilters((prev) => ({
                ...prev,
                emissionTagQuery: nextValue
              }));
              setAppliedFilters((prev) => ({
                ...prev,
                emissionTagQuery: nextValue
              }));
              setPage(1);
              setPageInput("1");
            }}
            placeholder="Select one or more"
          />
        </label>
        <label>
          Status
          <select
            value={draftFilters.status}
            onChange={(event) => {
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, status: value }));
              setAppliedFilters((prev) => ({ ...prev, status: value }));
              setPage(1);
              setPageInput("1");
            }}
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="observed">Observed</option>
            <option value="processed">Processed</option>
          </select>
        </label>
        <label>
          Instrument
          <ExpandableMultiSelect
            options={INSTRUMENT_OPTIONS}
            selectedValues={parseSelectedTags(draftFilters.instrumentQuery)}
            onChange={(nextValues) => {
              const nextValue = nextValues.join(MULTI_VALUE_DELIMITER);
              setDraftFilters((prev) => ({
                ...prev,
                instrumentQuery: nextValue
              }));
              setAppliedFilters((prev) => ({
                ...prev,
                instrumentQuery: nextValue
              }));
              setPage(1);
              setPageInput("1");
            }}
            placeholder="Select one or more"
          />
        </label>
        <label>
          Priority
          <select
            value={draftFilters.priority}
            onChange={(event) => {
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, priority: value }));
              setAppliedFilters((prev) => ({ ...prev, priority: value }));
              setPage(1);
              setPageInput("1");
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
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, zMin: value }));
              setAppliedFilters((prev) => ({ ...prev, zMin: value }));
              setPage(1);
              setPageInput("1");
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
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, zMax: value }));
              setAppliedFilters((prev) => ({ ...prev, zMax: value }));
              setPage(1);
              setPageInput("1");
            }}
            placeholder="9.0"
          />
        </label>
      </section>

      {allQuickTags.length > 0 ? (
        <section className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Quick tags
          </p>
          {selectedQuickTags.length > 0 ? (
            <p className="muted">Selected: {selectedQuickTags.join(", ")}</p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {allQuickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="secondary"
                onClick={() => setQuickTagFilter(tag)}
                style={{
                  padding: "0.22rem 0.52rem",
                  borderRadius: "999px",
                  background:
                    selectedQuickTags.some((item) => item.toLowerCase() === tag.toLowerCase())
                      ? "#d9f4ea"
                      : undefined
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {allEmissionTags.length > 0 ? (
        <section className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Emission line tags
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {allEmissionTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="secondary"
                onClick={() => setEmissionTagFilter(tag)}
                style={{
                  padding: "0.22rem 0.52rem",
                  borderRadius: "999px",
                  background:
                    selectedEmissionTags.some((item) => item.toLowerCase() === tag.toLowerCase())
                      ? "#d9f4ea"
                      : undefined
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Instruments
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {INSTRUMENT_OPTIONS.map((instrument) => (
            <button
              key={instrument}
              type="button"
              className="secondary"
              onClick={() => {
                const nextValue = toggleTagValue(appliedFilters.instrumentQuery, instrument);
                setDraftFilters((prev) => ({ ...prev, instrumentQuery: nextValue }));
                setAppliedFilters((prev) => ({ ...prev, instrumentQuery: nextValue }));
                setPage(1);
                setPageInput("1");
              }}
              style={{
                padding: "0.22rem 0.52rem",
                borderRadius: "999px",
                background:
                  selectedInstruments.some((item) => item.toLowerCase() === instrument.toLowerCase())
                    ? "#d9f4ea"
                    : undefined
              }}
            >
              {instrument}
            </button>
          ))}
        </div>
      </section>

      <section className="card grid grid-2" onKeyDown={handleSelectionSubmitFromKeyboard}>
        <label>
          Cone Search RA (deg)
          <input
            type="number"
            step="0.000001"
            value={draftFilters.coneRa}
            onChange={(event) => {
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, coneRa: value }));
              setAppliedFilters((prev) => ({ ...prev, coneRa: value }));
              setPage(1);
              setPageInput("1");
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
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, coneDec: value }));
              setAppliedFilters((prev) => ({ ...prev, coneDec: value }));
              setPage(1);
              setPageInput("1");
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
              const value = event.target.value;
              setDraftFilters((prev) => ({ ...prev, coneRadiusArcsec: value }));
              setAppliedFilters((prev) => ({ ...prev, coneRadiusArcsec: value }));
              setPage(1);
              setPageInput("1");
            }}
            placeholder="2"
          />
        </label>
        <p className="muted" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
          Cone search returns the single best-match target within the radius and overrides other filters.
        </p>
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
                setPageInput("1");
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
                <button onClick={() => toggleSort("instrument")}>Instrument {sortGlyph("instrument")}</button>
              </th>
              <th>
                <button onClick={() => toggleSort("priority")}>Priority {sortGlyph("priority")}</button>
              </th>
              <th>Quick Tags</th>
              <th>Emission Lines</th>
              <th>FitsMap</th>
              <th>
                <button onClick={() => toggleSort("assets")}>Assets {sortGlyph("assets")}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((target) => {
              const quickTags = getQuickTagsForTarget(target);
              const emissionTags = getEmissionLineTagsForTarget(target);
              const observationModes = observationModesForDisplay(target);
              const preview = firstImagePreview(target);
              const jadesId = jadesNumericId(target.name);
              return (
                <tr key={target.emerald_id}>
                  <td>
                    <span className="jades-cell">
                      <Link href={`/portal/targets/${target.emerald_id}?next=${encodeURIComponent(currentCatalogUrl)}`}>
                        {target.name}
                      </Link>
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
                    {observationModes.length > 0 ? (
                      <div style={{ display: "flex", gap: "0.28rem", flexWrap: "wrap" }}>
                        {observationModes.map((mode) => (
                          <span key={`${target.emerald_id}-status-${mode.instrument}-${mode.status}`} className="tag">
                            {mode.status}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {observationModes.length > 0 ? (
                      <div style={{ display: "flex", gap: "0.28rem", flexWrap: "wrap" }}>
                        {observationModes.map((mode) => {
                          const spectrumPreview = spectrumPreviewForInstrument(target, mode.instrument);
                          const showSpectrum =
                            (mode.instrument.toLowerCase() === "g140m/f070lp" ||
                              mode.instrument.toLowerCase() === "prism") &&
                            spectrumPreview;
                          if (showSpectrum) {
                            return (
                              <span
                                key={`${target.emerald_id}-instrument-${mode.instrument}-${mode.status}`}
                                className="jades-cell"
                              >
                                <a
                                  href={spectrumPreview}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="tag"
                                  title={`${mode.instrument}: click to open spectrum`}
                                >
                                  {mode.instrument}
                                </a>
                                <span className="hover-preview hover-preview--spectrum" role="tooltip">
                                  <Image
                                    src={spectrumPreview}
                                    alt={`${target.name} ${mode.instrument} spectrum`}
                                    width={320}
                                    height={220}
                                    unoptimized
                                  />
                                </span>
                              </span>
                            );
                          }

                          return (
                            <button
                              key={`${target.emerald_id}-instrument-${mode.instrument}-${mode.status}`}
                              type="button"
                              className="tag"
                              onClick={() => {
                                const nextValue = toggleTagValue(appliedFilters.instrumentQuery, mode.instrument);
                                setDraftFilters((prev) => ({ ...prev, instrumentQuery: nextValue }));
                                setAppliedFilters((prev) => ({ ...prev, instrumentQuery: nextValue }));
                                setPage(1);
                                setPageInput("1");
                              }}
                              style={{ cursor: "pointer" }}
                              title={`Filter by instrument: ${mode.instrument}`}
                            >
                              {mode.instrument}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>{target.priority}</td>
                  <td>
                    {quickTags.length > 0 ? (
                      <div style={{ display: "flex", gap: "0.28rem", flexWrap: "wrap" }}>
                        {quickTags.map((tag) => (
                          <button
                            key={`${target.emerald_id}-${tag}`}
                            type="button"
                            className="tag"
                            onClick={() => setQuickTagFilter(tag)}
                            style={{ cursor: "pointer" }}
                            title={`Filter by quick tag: ${tag}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {emissionTags.length > 0 ? (
                      <div style={{ display: "flex", gap: "0.28rem", flexWrap: "wrap" }}>
                        {emissionTags.map((tag) => (
                          <button
                            key={`${target.emerald_id}-line-${tag}`}
                            type="button"
                            className="tag"
                            onClick={() => setEmissionTagFilter(tag)}
                            style={{ cursor: "pointer" }}
                            title={`Filter by emission line: ${tag}`}
                          >
                            {tag}
                          </button>
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
            onClick={() => {
              const nextPage = Math.max(1, safePage - 1);
              setPage(nextPage);
              setPageInput(String(nextPage));
            }}
          >
            Previous
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>
              Page {safePage} / {totalPages}
            </span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              style={{ width: "88px" }}
              aria-label="Jump to page number"
            />
            <button type="button" className="secondary" onClick={jumpToPage}>
              Go
            </button>
          </div>
          <button
            className="secondary"
            disabled={safePage >= totalPages}
            onClick={() => {
              const nextPage = Math.min(totalPages, safePage + 1);
              setPage(nextPage);
              setPageInput(String(nextPage));
            }}
          >
            Next
          </button>
        </div>
      </section>

      <datalist id="target-quick-tags">
        {allQuickTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
