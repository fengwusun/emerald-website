import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const DEFAULT_LOCAL_MEDIA_DIR = "/Users/sunfengwu/Downloads/emerald_msa_ptg-2026";

function contentTypeForExtension(ext: string): string {
  switch (ext) {
    case ".fits":
      return "application/fits";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";

  if (!/^[-a-zA-Z0-9_./]+\.(fits|png|jpg|jpeg)$/i.test(file)) {
    return NextResponse.json({ error: "Invalid file parameter" }, { status: 400 });
  }

  if (file.startsWith("/") || file.includes("..") || file.includes("\\")) {
    return NextResponse.json({ error: "Invalid file parameter" }, { status: 400 });
  }

  const baseDir =
    process.env.EMERALD_LOCAL_MEDIA_DIR ||
    process.env.EMERALD_LOCAL_PDF_DIR ||
    DEFAULT_LOCAL_MEDIA_DIR;
  const resolvedBase = path.resolve(baseDir);
  const absolutePath = path.resolve(resolvedBase, file);

  if (!absolutePath.startsWith(`${resolvedBase}${path.sep}`) || !fs.existsSync(absolutePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = contentTypeForExtension(ext);
  const filename = path.basename(absolutePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}
