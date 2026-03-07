import { NextResponse } from "next/server";
import { PORTAL_COOKIE_NAME } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { getPublicOrigin } from "@/lib/request-origin";

export async function POST(request: Request) {
  const origin = getPublicOrigin(new Headers(request.headers), request.url);
  const response = NextResponse.redirect(new URL(withBasePath("/portal/login"), origin), { status: 303 });
  response.cookies.delete(PORTAL_COOKIE_NAME);
  return response;
}
