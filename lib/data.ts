import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parse } from "csv-parse/sync";
import { CoiMemberSchema, TargetRecordSchema, type CoiMember, type TargetRecord } from "@/lib/schemas";
import { getMediaBaseDir } from "@/lib/media-path";

const DATA_DIR = path.join(process.cwd(), "data");
const VI_CATALOG_PATH = path.join(DATA_DIR, "DIVER_grating_vi.csv");
const REDSHIFT_SUBMISSIONS_PATH = path.join(DATA_DIR, "redshift-submissions.ndjson");
const EMERALD_PROGRAM_ID = "7935";
const EMERALD_INSTRUMENT = "G395M/F290LP";
const DIVER_GRATING_INSTRUMENT = "G140M/F070LP";
const DIVER_PRISM_INSTRUMENT = "PRISM";
const DIVER_GRATING_DIR = "diver_grating_plots";
const DIVER_PRISM_PLOT_DIR = "diver_prism_plots";

const EMISSION_TAG_COLUMNS: ReadonlyArray<{ column: string; tag: string }> = [
  { column: "LyA", tag: "LyA" },
  { column: "HeII", tag: "HeII" },
  { column: "CIV", tag: "CIV" },
  { column: "CIII]", tag: "CIII]" },
  { column: "NIV]", tag: "NIV]" },
  { column: "OIII]", tag: "OIII]" },
  { column: "MgII", tag: "MgII" },
  { column: "OPT_OII", tag: "[OII]" },
  { column: "OPT_O3", tag: "[OIII]" },
  { column: "OPT_Hb", tag: "Hb" },
  { column: "OPT_4363", tag: "[OIII]4363" },
  { column: "Continuum_detected", tag: "Continuum_detected" }
];

type ViCatalogRecord = {
  sourceId: string;
  redshift: number | null;
  notes: string;
  emissionLineTags: string[];
};

type PrismAssetRecord = {
  sourceId: string;
  observationNumber: string;
  filename: string;
};

type PrismFitsAssetRecord = {
  sourceId: string;
  observationNumber: string;
  filename: string;
  kind: "s2d" | "x1d";
};

type GratingCsvAssetRecord = {
  sourceId: string;
  observationNumber: string;
  programId: string;
  filter: string;
  grating: string;
  filename: string;
  profiles: Array<{ column: string; slug: string }>;
};

type ObservationMode = {
  instrument: string;
  status: string;
};

type RedshiftSubmissionRecord = {
  source_name: string;
  emerald_id: string;
  z_best: number;
  submitted_at: string;
};

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function parseInstrumentLabels(value: string): string[] {
  return dedupe(
    value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );
}

function dedupeObservationModes(modes: ObservationMode[]): ObservationMode[] {
  const seen = new Set<string>();
  return modes.filter((mode) => {
    const key = `${mode.instrument.toLowerCase()}::${mode.status.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergeObservationMode(
  modes: ObservationMode[],
  nextMode: ObservationMode,
  overwriteStatus: boolean
): ObservationMode[] {
  const existing = modes.find((mode) => mode.instrument.toLowerCase() === nextMode.instrument.toLowerCase());
  if (!existing) {
    return dedupeObservationModes([...modes, nextMode]);
  }

  if (!overwriteStatus) {
    return dedupeObservationModes(modes);
  }

  return dedupeObservationModes(
    modes.map((mode) =>
      mode.instrument.toLowerCase() === nextMode.instrument.toLowerCase() ? nextMode : mode
    )
  );
}

function extractJadesSourceId(targetName: string): string | null {
  const match = targetName.match(/^JADES-(\d+)$/);
  return match ? match[1] : null;
}

function isYesLike(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "y" || normalized === "true" || normalized === "1";
}

function parseViRedshift(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function composeViNotes(row: Record<string, string>): string {
  const pieces = [row.comment_secondary, row.comment_lin]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);

  if (pieces.length === 0) {
    return "DIVER grating source";
  }

  return dedupe(pieces).join(" | ");
}

function buildDiverSpectrumAsset(sourceId: string) {
  return {
    asset_type: "spectrum" as const,
    label: "DIVER Grating Spectrum",
    storage_key: `${DIVER_GRATING_DIR}/spectrum_plot_${sourceId}.png`,
    preview_url: `/api/targets/image?file=${DIVER_GRATING_DIR}/spectrum_plot_${sourceId}.png`,
    access_level: "team" as const
  };
}

function buildDiverGratingCsvSpectrumAsset(
  record: GratingCsvAssetRecord,
  profile: { column: string; slug: string }
) {
  const profileLabel = profile.slug;
  const jsonFilename = record.filename.replace(/\.csv$/i, `__${profile.slug}_x1d.json`);
  return {
    asset_type: "spectrum" as const,
    label: `DIVER Grating 1D (o${record.observationNumber}, ${record.filter}/${record.grating}, ${profileLabel})`,
    storage_key: `${DIVER_GRATING_DIR}/${jsonFilename}`,
    access_level: "team" as const
  };
}

function buildDiverGratingCsvDownloadAsset(
  record: GratingCsvAssetRecord,
  profile: { column: string; slug: string }
) {
  return {
    asset_type: "other" as const,
    label: `DIVER Grating 1D CSV (o${record.observationNumber}, ${record.filter}/${record.grating}, ${profile.slug})`,
    storage_key: `${DIVER_GRATING_DIR}/${record.filename}`,
    spectrum_profile: profile.column,
    preview_url: `/api/targets/file?file=${DIVER_GRATING_DIR}/${record.filename}`,
    access_level: "team" as const
  };
}

function buildPrismSpectrumAsset(record: PrismAssetRecord) {
  return {
    asset_type: "spectrum" as const,
    label: `DIVER PRISM Spectrum (o${record.observationNumber})`,
    storage_key: `${DIVER_PRISM_PLOT_DIR}/${record.filename}`,
    preview_url: `/api/targets/image?file=${DIVER_PRISM_PLOT_DIR}/${record.filename}`,
    access_level: "team" as const
  };
}

function buildPrismFitsAsset(record: PrismFitsAssetRecord) {
  const label = record.kind === "s2d" ? "DIVER PRISM Spectrum 2D FITS" : "DIVER PRISM Spectrum 1D FITS";
  return {
    asset_type: "other" as const,
    label: `${label} (o${record.observationNumber})`,
    storage_key: `${DIVER_PRISM_PLOT_DIR}/${record.filename}`,
    preview_url: `/api/targets/file?file=${DIVER_PRISM_PLOT_DIR}/${record.filename}`,
    access_level: "team" as const
  };
}

function attachAssets(
  target: TargetRecord,
  nextAssets: Array<TargetRecord["ancillary_assets"][number]>
): TargetRecord {
  if (nextAssets.length === 0) {
    return target;
  }
  const existingKeys = new Set(
    target.ancillary_assets.map(
      (asset) => `${asset.storage_key.toLowerCase()}::${(asset.spectrum_profile ?? "").toLowerCase()}`
    )
  );
  const filtered = nextAssets.filter((asset) => {
    const key = `${asset.storage_key.toLowerCase()}::${(asset.spectrum_profile ?? "").toLowerCase()}`;
    return !existingKeys.has(key);
  });
  if (filtered.length === 0) {
    return target;
  }
  return {
    ...target,
    ancillary_assets: [...target.ancillary_assets, ...filtered]
  };
}

function attachDiverSpectrumAsset(target: TargetRecord, sourceId: string): TargetRecord {
  return attachAssets(target, [buildDiverSpectrumAsset(sourceId)]);
}

function localMediaBaseDir(): string {
  return getMediaBaseDir();
}

function loadPrismAssetsBySourceId(): Map<string, PrismAssetRecord[]> {
  const prismDir = path.join(localMediaBaseDir(), DIVER_PRISM_PLOT_DIR);
  if (!fs.existsSync(prismDir)) {
    return new Map();
  }

  const files = fs.readdirSync(prismDir);
  const bySourceId = new Map<string, PrismAssetRecord[]>();
  const prismPattern = /^jw_o(\d+)_([0-9]+)_.*prism.*\.png$/i;

  for (const filename of files) {
    const match = filename.match(prismPattern);
    if (!match) {
      continue;
    }
    const record: PrismAssetRecord = {
      observationNumber: match[1],
      sourceId: match[2],
      filename
    };
    const existing = bySourceId.get(record.sourceId) ?? [];
    existing.push(record);
    bySourceId.set(record.sourceId, existing);
  }

  for (const [sourceId, records] of bySourceId.entries()) {
    bySourceId.set(
      sourceId,
      records.sort((a, b) => a.filename.localeCompare(b.filename))
    );
  }

  return bySourceId;
}

function parseGratingProfilesFromHeader(csvPath: string): Array<{ column: string; slug: string }> {
  try {
    const raw = fs.readFileSync(csvPath, "utf8");
    const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
    if (!firstLine) return [];
    const headers = parse(firstLine, { relax_quotes: true }) as string[][];
    const columns = headers[0] ?? [];
    const fluxColumns = columns
      .map((column) => column.trim())
      .filter((column) => /^flux_[-a-zA-Z0-9_]+_cgs$/i.test(column));
    return fluxColumns
      .filter((column) => {
      const profilePart = column.replace(/^flux_/i, "").replace(/_cgs$/i, "");
      const errorColumn = `fluxerr_${profilePart}_cgs`;
      return columns.includes(errorColumn);
      })
      .map((column) => ({
        column,
        slug: column.replace(/^flux_/i, "").replace(/_cgs$/i, "")
      }));
  } catch {
    return [];
  }
}

function loadGratingCsvAssetsBySourceId(): Map<string, GratingCsvAssetRecord[]> {
  const gratingDir = path.join(localMediaBaseDir(), DIVER_GRATING_DIR);
  if (!fs.existsSync(gratingDir)) {
    return new Map();
  }

  const files = fs.readdirSync(gratingDir);
  const bySourceId = new Map<string, GratingCsvAssetRecord[]>();
  const csvPattern =
    /^jw_o(\d+)_([0-9]+)_([0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_.*bundle_1d\.csv$/i;

  for (const filename of files) {
    const match = filename.match(csvPattern);
    if (!match) {
      continue;
    }
    const profiles = parseGratingProfilesFromHeader(path.join(gratingDir, filename));
    if (profiles.length === 0) {
      continue;
    }
    const record: GratingCsvAssetRecord = {
      observationNumber: match[1],
      programId: match[2],
      sourceId: match[3],
      filter: match[4].toUpperCase(),
      grating: match[5].toUpperCase(),
      filename,
      profiles
    };
    const existing = bySourceId.get(record.sourceId) ?? [];
    existing.push(record);
    bySourceId.set(record.sourceId, existing);
  }

  for (const [sourceId, records] of bySourceId.entries()) {
    bySourceId.set(
      sourceId,
      records.sort((a, b) => a.filename.localeCompare(b.filename))
    );
  }

  return bySourceId;
}

function loadPrismFitsAssetsBySourceId(): Map<string, PrismFitsAssetRecord[]> {
  const prismDir = path.join(localMediaBaseDir(), DIVER_PRISM_PLOT_DIR);
  if (!fs.existsSync(prismDir)) {
    return new Map();
  }

  const files = fs.readdirSync(prismDir);
  const bySourceId = new Map<string, PrismFitsAssetRecord[]>();
  const fitsPattern = /^jw_o(\d+)_([0-9]+)_CLEAR_PRISM_(s2d|x1d)\.fits$/i;

  for (const filename of files) {
    const match = filename.match(fitsPattern);
    if (!match) {
      continue;
    }
    const kind = match[3].toLowerCase() === "s2d" ? "s2d" : "x1d";
    const record: PrismFitsAssetRecord = {
      observationNumber: match[1],
      sourceId: match[2],
      filename,
      kind
    };
    const existing = bySourceId.get(record.sourceId) ?? [];
    existing.push(record);
    bySourceId.set(record.sourceId, existing);
  }

  for (const [sourceId, records] of bySourceId.entries()) {
    bySourceId.set(
      sourceId,
      records.sort((a, b) => a.filename.localeCompare(b.filename))
    );
  }

  return bySourceId;
}

function loadViCatalogBySourceId(): Map<string, ViCatalogRecord> {
  if (!fs.existsSync(VI_CATALOG_PATH)) {
    return new Map();
  }

  const viRaw = fs.readFileSync(VI_CATALOG_PATH, "utf8");
  const viRows = parse(viRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  const catalogBySourceId = new Map<string, ViCatalogRecord>();
  for (const row of viRows) {
    const sourceId = row.sourceid?.trim();
    if (!sourceId) {
      continue;
    }

    const emissionLineTags = EMISSION_TAG_COLUMNS.filter(({ column }) => isYesLike(row[column])).map(({ tag }) => tag);
    catalogBySourceId.set(sourceId, {
      sourceId,
      redshift: parseViRedshift(row.redshift),
      notes: composeViNotes(row),
      emissionLineTags
    });
  }

  return catalogBySourceId;
}

function loadLatestSubmittedRedshifts(): {
  bySourceName: Map<string, number>;
  byEmeraldId: Map<string, number>;
} {
  if (!fs.existsSync(REDSHIFT_SUBMISSIONS_PATH)) {
    return { bySourceName: new Map(), byEmeraldId: new Map() };
  }

  const raw = fs.readFileSync(REDSHIFT_SUBMISSIONS_PATH, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const latestBySourceName = new Map<string, { submittedAt: string; zBest: number }>();
  const latestByEmeraldId = new Map<string, { submittedAt: string; zBest: number }>();

  for (const line of lines) {
    let parsed: Partial<RedshiftSubmissionRecord> | null = null;
    try {
      parsed = JSON.parse(line) as Partial<RedshiftSubmissionRecord>;
    } catch {
      continue;
    }
    if (!parsed) continue;
    const sourceName = (parsed.source_name ?? "").trim();
    const emeraldId = (parsed.emerald_id ?? "").trim();
    const submittedAt = (parsed.submitted_at ?? "").trim();
    const zBest = Number(parsed.z_best);
    if (!submittedAt || !Number.isFinite(zBest)) {
      continue;
    }

    if (sourceName) {
      const existing = latestBySourceName.get(sourceName);
      if (!existing || submittedAt >= existing.submittedAt) {
        latestBySourceName.set(sourceName, { submittedAt, zBest });
      }
    }

    if (emeraldId) {
      const existing = latestByEmeraldId.get(emeraldId);
      if (!existing || submittedAt >= existing.submittedAt) {
        latestByEmeraldId.set(emeraldId, { submittedAt, zBest });
      }
    }
  }

  const bySourceName = new Map<string, number>();
  const byEmeraldId = new Map<string, number>();
  for (const [key, value] of latestBySourceName.entries()) {
    bySourceName.set(key, value.zBest);
  }
  for (const [key, value] of latestByEmeraldId.entries()) {
    byEmeraldId.set(key, value.zBest);
  }

  return { bySourceName, byEmeraldId };
}

export function loadTargets(): TargetRecord[] {
  const csvPath = path.join(DATA_DIR, "targets.csv");
  const csvRaw = fs.readFileSync(csvPath, "utf8");
  const viCatalogBySourceId = loadViCatalogBySourceId();
  const gratingCsvAssetsBySourceId = loadGratingCsvAssetsBySourceId();
  const prismAssetsBySourceId = loadPrismAssetsBySourceId();
  const prismFitsAssetsBySourceId = loadPrismFitsAssetsBySourceId();

  const records = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  const targets = records.map((record) => {
    const target = TargetRecordSchema.parse(record);
    const sourceId = extractJadesSourceId(target.name);
    const baseInstruments = parseInstrumentLabels(target.instrument);
    const instruments =
      target.jwst_program_id === EMERALD_PROGRAM_ID
        ? dedupe([...baseInstruments, EMERALD_INSTRUMENT])
        : baseInstruments;
    const baseObservationModes = dedupeObservationModes(
      instruments.map((instrument) => ({
        instrument,
        status: target.status
      }))
    );
    const baseTarget = {
      ...target,
      instrument: instruments.join(", "),
      instruments,
      observation_modes: baseObservationModes
    };

    if (!sourceId) {
      return baseTarget;
    }

    const viRecord = viCatalogBySourceId.get(sourceId);
    const gratingCsvRecords = gratingCsvAssetsBySourceId.get(sourceId) ?? [];
    const prismRecords = prismAssetsBySourceId.get(sourceId) ?? [];
    const prismFitsRecords = prismFitsAssetsBySourceId.get(sourceId) ?? [];
    const gratingCsvAssets = gratingCsvRecords.flatMap((record) =>
      record.profiles.flatMap((profile) => [
        buildDiverGratingCsvSpectrumAsset(record, profile),
        buildDiverGratingCsvDownloadAsset(record, profile)
      ])
    );
    const prismAssets = prismRecords.map((prismRecord) => buildPrismSpectrumAsset(prismRecord));
    const prismFitsAssets = prismFitsRecords.map((prismFitsRecord) => buildPrismFitsAsset(prismFitsRecord));
    let merged = attachAssets(baseTarget, [...gratingCsvAssets, ...prismAssets, ...prismFitsAssets]);

    if (prismAssets.length > 0) {
      merged = {
        ...merged,
        instrument: dedupe([...merged.instruments, DIVER_PRISM_INSTRUMENT]).join(", "),
        instruments: dedupe([...merged.instruments, DIVER_PRISM_INSTRUMENT]),
        observation_modes: mergeObservationMode(
          merged.observation_modes,
          { instrument: DIVER_PRISM_INSTRUMENT, status: "observed" },
          true
        )
      };
    }

    if (!viRecord && gratingCsvRecords.length === 0) {
      return merged;
    }

    const withSpectrum = attachDiverSpectrumAsset(merged, sourceId);
    const withGratingMode = {
      ...withSpectrum,
      status: withSpectrum.status,
      instrument: dedupe([...withSpectrum.instruments, DIVER_GRATING_INSTRUMENT]).join(", "),
      instruments: dedupe([...withSpectrum.instruments, DIVER_GRATING_INSTRUMENT]),
      observation_modes: mergeObservationMode(
        withSpectrum.observation_modes,
        { instrument: DIVER_GRATING_INSTRUMENT, status: "observed" },
        true
      )
    };

    if (!viRecord) {
      return withGratingMode;
    }

    return {
      ...withGratingMode,
      emission_line_tags: viRecord?.emissionLineTags ?? []
    };
  });

  const knownSourceIds = new Set(
    targets
      .map((target) => extractJadesSourceId(target.name))
      .filter((value): value is string => value !== null)
  );

  const allCatalogSourceIds = new Set<string>([
    ...viCatalogBySourceId.keys(),
    ...gratingCsvAssetsBySourceId.keys(),
    ...prismAssetsBySourceId.keys(),
    ...prismFitsAssetsBySourceId.keys()
  ]);

  for (const sourceId of allCatalogSourceIds) {
    if (knownSourceIds.has(sourceId)) {
      continue;
    }

    const viRecord = viCatalogBySourceId.get(sourceId);
    const gratingCsvRecords = gratingCsvAssetsBySourceId.get(sourceId) ?? [];
    const prismRecords = prismAssetsBySourceId.get(sourceId) ?? [];
    const prismFitsRecords = prismFitsAssetsBySourceId.get(sourceId) ?? [];
    const hasGrating = viRecord !== undefined || gratingCsvRecords.length > 0;
    const hasPrism = prismRecords.length > 0 || prismFitsRecords.length > 0;
    const instruments = dedupe([
      ...(hasGrating ? [DIVER_GRATING_INSTRUMENT] : []),
      ...(hasPrism ? [DIVER_PRISM_INSTRUMENT] : [])
    ]);
    const ancillaryAssets = [
      ...(hasGrating ? [buildDiverSpectrumAsset(sourceId)] : []),
      ...gratingCsvRecords.flatMap((record) =>
        record.profiles.flatMap((profile) => [
          buildDiverGratingCsvSpectrumAsset(record, profile),
          buildDiverGratingCsvDownloadAsset(record, profile)
        ])
      ),
      ...prismRecords.map((prismRecord) => buildPrismSpectrumAsset(prismRecord)),
      ...prismFitsRecords.map((prismFitsRecord) => buildPrismFitsAsset(prismFitsRecord))
    ];
    const noteParts = [
      viRecord?.notes ?? "",
      hasPrism ? "DIVER PRISM source" : "",
      "Coordinates pending"
    ].filter((part) => part.length > 0);

    targets.push({
      emerald_id: `DIV-${sourceId}`,
      name: `JADES-${sourceId}`,
      ra: 0,
      dec: 0,
      z_spec: viRecord?.redshift ?? 1,
      status: "observed",
      instrument: instruments.join(", "),
      priority: "low",
      jwst_program_id: "8018",
      notes: noteParts.join(" | "),
      ancillary_assets: ancillaryAssets,
      instruments,
      observation_modes: instruments.map((instrument) => ({ instrument, status: "observed" })),
      emission_line_tags: viRecord?.emissionLineTags ?? []
    });
  }

  const latestSubmitted = loadLatestSubmittedRedshifts();
  const targetsWithSubmittedRedshifts = targets.map((target) => {
    const byId = latestSubmitted.byEmeraldId.get(target.emerald_id);
    const byName = latestSubmitted.bySourceName.get(target.name);
    const nextZ = byId ?? byName;
    if (typeof nextZ !== "number" || !Number.isFinite(nextZ)) {
      return target;
    }
    return {
      ...target,
      z_spec: nextZ
    };
  });

  return targetsWithSubmittedRedshifts;
}

export function loadCoiMembers(): CoiMember[] {
  const yamlPath = path.join(DATA_DIR, "coi.yaml");
  const raw = fs.readFileSync(yamlPath, "utf8");
  const parsed = yaml.load(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("coi.yaml must contain a top-level array.");
  }
  return parsed.map((entry) => CoiMemberSchema.parse(entry));
}

export function getTargetById(emeraldId: string): TargetRecord | null {
  const targets = loadTargets();
  return targets.find((target) => target.emerald_id === emeraldId) ?? null;
}
