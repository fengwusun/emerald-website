import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  hasScienceAdminSession,
  isScienceAdminConfigured,
  SCIENCE_ADMIN_COOKIE_NAME
} from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(SCIENCE_ADMIN_COOKIE_NAME)?.value;

  return NextResponse.json({
    configured: isScienceAdminConfigured(),
    isAdmin: hasScienceAdminSession(adminCookie)
  });
}
