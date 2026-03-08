import { NextResponse } from "next/server";
import { loadCoiMembers } from "@/lib/data";
import { isPortalPasswordValid, isPortalAuthConfigured } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isPortalAuthConfigured()) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  let body: { password?: string } = {};
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.password || !isPortalPasswordValid(body.password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const members = loadCoiMembers();
  const emails: Record<string, string> = {};
  for (const m of members) {
    if (m.email) {
      emails[m.name] = m.email;
    }
  }
  return NextResponse.json({ emails });
}
