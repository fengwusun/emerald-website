import { NextResponse } from "next/server";
import {
  expectedScienceAdminSessionValue,
  isScienceAdminConfigured,
  isScienceAdminPasswordValid,
  SCIENCE_ADMIN_COOKIE_NAME
} from "@/lib/auth";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let password = "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as
      | { password?: unknown }
      | null;
    password = typeof payload?.password === "string" ? payload.password : "";
  } else {
    const form = await request.formData();
    password = String(form.get("password") ?? "");
  }

  if (!isScienceAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin mode is not configured on the server." },
      { status: 503 }
    );
  }

  if (!password || !isScienceAdminPasswordValid(password)) {
    return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SCIENCE_ADMIN_COOKIE_NAME,
    expectedScienceAdminSessionValue(),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    }
  );
  return response;
}
