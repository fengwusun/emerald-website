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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const parsed = RequestSchema.safeParse({ key });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid spectrum key request" }, { status: 400 });
  }

  const targets = loadTargets();
  const knownAssetKeys = new Set(targets.flatMap((target) => target.ancillary_assets.map((asset) => asset.storage_key)));
  if (!knownAssetKeys.has(parsed.data.key)) {
    return NextResponse.json({ error: "Spectrum key not found in catalog" }, { status: 404 });
  }

  if (parsed.data.key.startsWith("/") || parsed.data.key.includes("..") || parsed.data.key.includes("\\")) {
    return NextResponse.json({ error: "Invalid spectrum key" }, { status: 400 });
  }

  const mediaBaseDir = getMediaBaseDir();
  const resolvedBase = path.resolve(mediaBaseDir);
  const keyLower = parsed.data.key.toLowerCase();

  if (keyLower.endsWith("_x1d.fits")) {
    const cacheRelativePath = parsed.data.key.replace(/\.fits$/i, ".json");
    const cacheAbsolutePath = path.resolve(resolvedBase, cacheRelativePath);

    if (
      !cacheAbsolutePath.startsWith(`${resolvedBase}${path.sep}`) ||
      !fs.existsSync(cacheAbsolutePath)
    ) {
      return NextResponse.json(
        {
          error:
            "Spectrum cache JSON not found. Run the corresponding x1d cache build script to generate it."
        },
        { status: 404 }
      );
    }

    const raw = fs.readFileSync(cacheAbsolutePath, "utf8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=3600"
      }
    });
  }

  if (keyLower.endsWith("_x1d.json")) {
    const jsonAbsolutePath = path.resolve(resolvedBase, parsed.data.key);
    if (!jsonAbsolutePath.startsWith(`${resolvedBase}${path.sep}`) || !fs.existsSync(jsonAbsolutePath)) {
      return NextResponse.json({ error: "x1d JSON spectrum file not found" }, { status: 404 });
    }
    const raw = fs.readFileSync(jsonAbsolutePath, "utf8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=3600"
      }
    });
  }

  return NextResponse.json({ error: "Unsupported spectrum key format" }, { status: 400 });
}
