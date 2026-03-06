import { NextResponse } from "next/server";
import {
  isPortalPasswordValid,
  isPortalAuthConfigured,
  expectedSessionValue,
  PORTAL_COOKIE_NAME
} from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { getPublicOrigin } from "@/lib/request-origin";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const nextPathRaw = String(formData.get("next") ?? withBasePath("/portal/targets"));
  const nextPath = nextPathRaw.startsWith("/") ? nextPathRaw : withBasePath("/portal/targets");

  const origin = getPublicOrigin(new Headers(request.headers), request.url);

  if (!isPortalAuthConfigured()) {
    const configUrl = new URL(
      `${withBasePath("/portal/login")}?error=config&next=${encodeURIComponent(nextPath)}`,
      origin
    );
    return NextResponse.redirect(configUrl, { status: 303 });
  }

  if (!password || !isPortalPasswordValid(password)) {
    const errorUrl = new URL(
      `${withBasePath("/portal/login")}?error=1&next=${encodeURIComponent(nextPath)}`,
      origin
    );
    return NextResponse.redirect(errorUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(nextPath, origin), { status: 303 });
  response.cookies.set(PORTAL_COOKIE_NAME, expectedSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}
