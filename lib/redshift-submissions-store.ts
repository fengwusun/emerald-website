import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { RedshiftSubmissionInput } from "@/lib/schemas";

const STORE_PATH = path.join(process.cwd(), "data", "redshift-submissions.ndjson");

export type StoredRedshiftSubmission = {
  id: string;
  submitted_at: string;
  source_name: string;
  emerald_id: string;
  source_id: string;
  z_best: number;
  selected_line_ids: string[];
  confidence: "low" | "medium" | "high" | "";
  reporter_name: string;
  reporter_email: string;
  comment: string;
  spectrum_asset_key: string;
  ip_hash: string;
  user_agent: string;
};

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim();
}

function hashIp(ipAddress: string): string {
  const salt = process.env.EMERALD_REDSHIFT_IP_SALT ?? "emerald-redshift-default-salt";
  return crypto.createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
}

export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  const realIp = headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

export async function appendRedshiftSubmission(
  input: RedshiftSubmissionInput & { emerald_id?: string; source_id?: string },
  metadata: { ipAddress: string; userAgent: string }
): Promise<StoredRedshiftSubmission> {
  const now = new Date().toISOString();
  const submission: StoredRedshiftSubmission = {
    id: `rz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submitted_at: now,
    source_name: normalizeText(input.source_name),
    emerald_id: normalizeText(input.emerald_id),
    source_id: normalizeText(input.source_id),
    z_best: Math.round(input.z_best * 1e3) / 1e3,
    selected_line_ids: input.selected_line_ids,
    confidence: input.confidence ?? "",
    reporter_name: normalizeText(input.reporter_name),
    reporter_email: normalizeText(input.reporter_email).toLowerCase(),
    comment: normalizeText(input.comment),
    spectrum_asset_key: normalizeText(input.spectrum_asset_key),
    ip_hash: hashIp(metadata.ipAddress),
    user_agent: normalizeText(metadata.userAgent)
  };

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.appendFile(STORE_PATH, `${JSON.stringify(submission)}\n`, "utf8");
  return submission;
}

export async function readRedshiftSubmissions(): Promise<StoredRedshiftSubmission[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as StoredRedshiftSubmission;
        } catch {
          return null;
        }
      })
      .filter((row): row is StoredRedshiftSubmission => row !== null)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
