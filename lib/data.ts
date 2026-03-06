import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parse } from "csv-parse/sync";
import { CoiMemberSchema, TargetRecordSchema, type CoiMember, type TargetRecord } from "@/lib/schemas";

const DATA_DIR = path.join(process.cwd(), "data");

export function loadTargets(): TargetRecord[] {
  const csvPath = path.join(DATA_DIR, "targets.csv");
  const csvRaw = fs.readFileSync(csvPath, "utf8");

  const records = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  return records.map((record) => TargetRecordSchema.parse(record));
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
