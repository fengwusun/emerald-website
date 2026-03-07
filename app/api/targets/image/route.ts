import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getMediaBaseDir } from "@/lib/media-path";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";

  if (!/^[-a-zA-Z0-9_./]+\.(jpg|jpeg|png)$/i.test(file)) {
    return NextResponse.json({ error: "Invalid file parameter" }, { status: 400 });
  }

  if (file.startsWith("/") || file.includes("..") || file.includes("\\")) {
    return NextResponse.json({ error: "Invalid file parameter" }, { status: 400 });
  }

  const baseDir = getMediaBaseDir();
  const resolvedBase = path.resolve(baseDir);
  const absolutePath = path.resolve(resolvedBase, file);

  if (!absolutePath.startsWith(`${resolvedBase}${path.sep}`) || !fs.existsSync(absolutePath)) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600"
    }
  });
}
