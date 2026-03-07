import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadTargets } from "@/lib/data";
import { RedshiftSubmissionInputSchema } from "@/lib/schemas";
import {
  appendRedshiftSubmission,
  extractClientIp,
  readRedshiftSubmissions
} from "@/lib/redshift-submissions-store";

const PostBodySchema = RedshiftSubmissionInputSchema;

const GetQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional()
});

export async function POST(request: NextRequest) {
  let parsedBody: z.infer<typeof PostBodySchema>;
  try {
    parsedBody = PostBodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid submission payload", details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Unable to parse JSON body" }, { status: 400 });
  }

  const targets = loadTargets();
  const byEmeraldId = parsedBody.emerald_id
    ? targets.find((target) => target.emerald_id === parsedBody.emerald_id)
    : null;
  const byName = targets.find((target) => target.name === parsedBody.source_name);
  const matchedTarget = byEmeraldId ?? byName ?? null;

  if (!matchedTarget) {
    return NextResponse.json(
      { error: "Unknown source. Please submit from a valid target detail page." },
      { status: 400 }
    );
  }

  const jadesMatch = matchedTarget.name.match(/^JADES-(\d+)$/);
  const sourceId = parsedBody.source_id || (jadesMatch ? jadesMatch[1] : "");
  const userAgent = request.headers.get("user-agent") ?? "";
  const ipAddress = extractClientIp(request.headers);

  const saved = await appendRedshiftSubmission(
    {
      ...parsedBody,
      emerald_id: matchedTarget.emerald_id,
      source_name: matchedTarget.name,
      source_id: sourceId
    },
    {
      ipAddress,
      userAgent
    }
  );

  return NextResponse.json({ ok: true, submission: saved }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const parsedQuery = GetQuerySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const all = await readRedshiftSubmissions();
  const limit = parsedQuery.data.limit ?? 200;
  return NextResponse.json({ submissions: all.slice(0, limit) });
}
