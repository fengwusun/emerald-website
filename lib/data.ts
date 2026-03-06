import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parse } from "csv-parse/sync";
import { CoiMemberSchema, TargetRecordSchema, type CoiMember, type TargetRecord } from "@/lib/schemas";

const DATA_DIR = path.join(process.cwd(), "data");
const VI_CATALOG_PATH = path.join(DATA_DIR, "diver_vi_combined.csv");

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
  { column: "OPT_4363", tag: "[OIII]4363" }
];

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

function loadEmissionLineTagsBySourceId(): Map<string, string[]> {
  if (!fs.existsSync(VI_CATALOG_PATH)) {
    return new Map();
  }

  const viRaw = fs.readFileSync(VI_CATALOG_PATH, "utf8");
  const viRows = parse(viRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  const tagsBySourceId = new Map<string, string[]>();
  for (const row of viRows) {
    const sourceId = row.sourceid?.trim();
    if (!sourceId) {
      continue;
    }

    const tags = EMISSION_TAG_COLUMNS.filter(({ column }) => isYesLike(row[column])).map(({ tag }) => tag);
    if (tags.length > 0) {
      tagsBySourceId.set(sourceId, tags);
    }
  }

  return tagsBySourceId;
}

export function loadTargets(): TargetRecord[] {
  const csvPath = path.join(DATA_DIR, "targets.csv");
  const csvRaw = fs.readFileSync(csvPath, "utf8");
  const emissionTagsBySourceId = loadEmissionLineTagsBySourceId();

  const records = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  return records.map((record) => {
    const target = TargetRecordSchema.parse(record);
    const sourceId = extractJadesSourceId(target.name);

    if (!sourceId) {
      return target;
    }

    return {
      ...target,
      emission_line_tags: emissionTagsBySourceId.get(sourceId) ?? []
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
