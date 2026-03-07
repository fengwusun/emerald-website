import { NextResponse } from "next/server";
import { loadTargets } from "@/lib/data";

export async function GET() {
  try {
    const targets = loadTargets();
    return NextResponse.json(
      { targets },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load targets catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
