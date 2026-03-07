import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasPortalSession, PORTAL_COOKIE_NAME } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { getPublicOrigin } from "@/lib/request-origin";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const portalLoginPath = withBasePath("/portal/login");

  if (
    pathname.startsWith("/portal/login") ||
    pathname.startsWith(portalLoginPath)
  ) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(PORTAL_COOKIE_NAME)?.value;
  if (!hasPortalSession(cookieValue)) {
    const origin = getPublicOrigin(request.headers, request.url);
    const loginUrl = new URL(withBasePath("/portal/login"), origin);
    const nextPath = request.nextUrl.basePath
      ? `${request.nextUrl.basePath}${pathname}`
      : withBasePath(pathname);
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/science-projects/:path*",
    "/portal/:path*",
    "/api/assets/sign",
    "/api/targets/image",
    "/api/targets/file",
    "/api/targets/catalog",
    "/api/targets/catalog/download",
    "/api/spectra/1d",
    "/api/redshift-submissions"
  ]
};
