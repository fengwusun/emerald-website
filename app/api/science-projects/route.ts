import { NextResponse } from "next/server";
import {
  readScienceProjectsState,
  writeScienceProjectsState
} from "@/lib/science-projects-store";
import {
  hasScienceAdminSession,
  isScienceAdminConfigured,
  SCIENCE_ADMIN_COOKIE_NAME
} from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(SCIENCE_ADMIN_COOKIE_NAME)?.value;
  const state = await readScienceProjectsState();
  return NextResponse.json(
    {
      ...state,
      isAdmin: hasScienceAdminSession(adminCookie),
      adminConfigured: isScienceAdminConfigured()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(SCIENCE_ADMIN_COOKIE_NAME)?.value;
  if (!hasScienceAdminSession(adminCookie)) {
    return NextResponse.json(
      { error: "Admin mode is required for this action." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  if (
    !Array.isArray(record.projects) ||
    !record.content ||
    typeof record.content !== "object"
  ) {
    return NextResponse.json({ error: "Invalid payload shape" }, { status: 400 });
  }

  const saved = await writeScienceProjectsState({
    projects: record.projects,
    content: record.content
  });

  return NextResponse.json(saved, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
