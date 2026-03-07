import { NextResponse } from "next/server";
import { z } from "zod";
import { createSignedAssetUrl } from "@/lib/assets";
import { loadTargets } from "@/lib/data";

const RequestSchema = z.object({
  key: z.string().min(1).regex(/^[-a-zA-Z0-9_./]+$/)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const parsed = RequestSchema.safeParse({ key });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid asset key" }, { status: 400 });
  }

  const knownAssetKeys = new Set(
    loadTargets().flatMap((target) => target.ancillary_assets.map((asset) => asset.storage_key))
  );
  if (!knownAssetKeys.has(parsed.data.key)) {
    return NextResponse.json({ error: "Asset key not found in catalog" }, { status: 404 });
  }

  try {
    const signedUrl = await createSignedAssetUrl(parsed.data.key);
    return NextResponse.json({ signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown signing error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
