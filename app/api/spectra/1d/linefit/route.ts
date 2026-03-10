import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadTargets } from "@/lib/data";
import { getMediaBaseDir } from "@/lib/media-path";

const RequestSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[-a-zA-Z0-9_./]+$/),
});

function extractSourceIdFromKey(key: string): string | null {
  const base = path.basename(key);
  const match = base.match(/_(\d+)_CLEAR_PRISM_x1d\.(fits|json)$/i);
  return match ? match[1] : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const parsed = RequestSchema.safeParse({ key });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid linefit request" }, { status: 400 });
  }

  const targets = loadTargets();
  const knownAssetKeys = new Set(targets.flatMap((target) => target.ancillary_assets.map((asset) => asset.storage_key)));
  if (!knownAssetKeys.has(parsed.data.key)) {
    return NextResponse.json({ error: "Spectrum key not found in catalog" }, { status: 404 });
  }
  if (parsed.data.key.startsWith("/") || parsed.data.key.includes("..") || parsed.data.key.includes("\\")) {
    return NextResponse.json({ error: "Invalid spectrum key" }, { status: 400 });
  }

  const sourceId = extractSourceIdFromKey(parsed.data.key);
  if (!sourceId) {
    return NextResponse.json({ error: "Unable to infer source id from key" }, { status: 400 });
  }

  const mediaBaseDir = getMediaBaseDir();
  const resolvedBase = path.resolve(mediaBaseDir);
  const keyDir = path.dirname(parsed.data.key);
  const absDir = path.resolve(resolvedBase, keyDir);
  if (!absDir.startsWith(`${resolvedBase}${path.sep}`) || !fs.existsSync(absDir)) {
    return NextResponse.json({ error: "Spectrum directory not found" }, { status: 404 });
  }

  const files = fs.readdirSync(absDir);
  const candidates = files
    .filter((name) => name.endsWith(".json"))
    .filter((name) => name.includes(`_${sourceId}_`))
    .filter(
      (name) =>
        name.includes("joint_lsf_fit") ||
        name.includes("lineflux")
    )
    .map((name) => {
      const abs = path.resolve(absDir, name);
      const st = fs.statSync(abs);
      return { name, abs, mtimeMs: st.mtimeMs, isJoint: name.includes("joint_lsf_fit") };
    });

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No line-fit JSON found for this source" }, { status: 404 });
  }

  candidates.sort((a, b) => {
    if (a.isJoint !== b.isJoint) return a.isJoint ? -1 : 1;
    return b.mtimeMs - a.mtimeMs;
  });
  const best = candidates[0];
  const raw = fs.readFileSync(best.abs, "utf8");

  // Return raw fit payload plus lightweight source metadata for debugging.
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corrupt line-fit JSON payload" }, { status: 500 });
  }
  const out = {
    source_id: sourceId,
    spectrum_key: parsed.data.key,
    linefit_key: `${keyDir}/${best.name}`.replace(/^\.\/+/, ""),
    ...payload,
  };
  return NextResponse.json(out, {
    headers: {
      "Cache-Control": "private, max-age=600",
    },
  });
}
