import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parse } from "csv-parse/sync";
import { CoiMemberSchema, TargetRecordSchema, type CoiMember, type TargetRecord } from "@/lib/schemas";

const DATA_DIR = path.join(process.cwd(), "data");
const VI_CATALOG_PATH = path.join(DATA_DIR, "DIVER_grating_vi.csv");
const EMERALD_PROGRAM_ID = "7935";
const EMERALD_INSTRUMENT = "G395M/F290LP";
const DIVER_GRATING_INSTRUMENT = "G140M/F070LP";

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
  emissionLineTags: string[];
};

type ObservationMode = {
  instrument: string;
  status: string;
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
    catalogBySourceId.set(sourceId, { emissionLineTags });
  }

  return catalogBySourceId;
}

export function loadTargets(): TargetRecord[] {
  const csvPath = path.join(DATA_DIR, "targets.csv");
  const csvRaw = fs.readFileSync(csvPath, "utf8");
  const viCatalogBySourceId = loadViCatalogBySourceId();

  const records = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  return records.map((record) => {
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

    if (!sourceId || !viCatalogBySourceId.has(sourceId)) {
      return baseTarget;
    }

    const viRecord = viCatalogBySourceId.get(sourceId);

    return {
      ...baseTarget,
      status: baseTarget.status,
      instrument: dedupe([...baseTarget.instruments, DIVER_GRATING_INSTRUMENT]).join(", "),
      instruments: dedupe([...baseTarget.instruments, DIVER_GRATING_INSTRUMENT]),
      observation_modes: mergeObservationMode(
        baseTarget.observation_modes,
        { instrument: DIVER_GRATING_INSTRUMENT, status: "observed" },
        true
      ),
      emission_line_tags: viRecord?.emissionLineTags ?? []
    };
  });
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
