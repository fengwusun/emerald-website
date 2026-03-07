import { NextResponse } from "next/server";
import { loadCoiMembers } from "@/lib/data";
import {
  createProjectId,
  normalizeName,
  nowIsoDate,
  readScienceProjectsState,
  writeScienceProjectsState
} from "@/lib/science-projects-store";

function normalizeUpdateLink(value: string): string {
  return value.trim();
}

function isValidUpdateLink(value: string): boolean {
  if (!value) return true;
  return /^https?:\/\//i.test(value);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        title?: unknown;
        abstract?: unknown;
        name?: unknown;
        updateLink?: unknown;
      }
    | null;

  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const abstract =
    typeof payload?.abstract === "string" ? payload.abstract.trim() : "";
  const name =
    typeof payload?.name === "string" ? normalizeName(payload.name) : "";
  const updateLink =
    typeof payload?.updateLink === "string"
      ? normalizeUpdateLink(payload.updateLink)
      : "";

  if (!title || !abstract || !name) {
    return NextResponse.json(
      { error: "Title, abstract, and submitter name are required." },
      { status: 400 }
    );
  }

  if (!isValidUpdateLink(updateLink)) {
    return NextResponse.json(
      { error: "Update link must start with http:// or https://." },
      { status: 400 }
    );
  }

  const members = loadCoiMembers();
  const member = members.find(
    (candidate) => normalizeName(candidate.name).toLowerCase() === name.toLowerCase()
  );

  if (!member) {
    return NextResponse.json(
      { error: "Submitter name must be selected from the Co-I list." },
      { status: 400 }
    );
  }

  const email = member.email.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Selected submitter does not have an email in the Co-I list yet." },
      { status: 400 }
    );
  }

  const state = await readScienceProjectsState();
  const nextState = {
    projects: [
      ...state.projects,
      {
        id: createProjectId("submitted"),
        title,
        abstract,
        announced: false,
        submitter: {
          name: member.name,
          email,
          updateLink,
          updateDate: updateLink ? nowIsoDate() : ""
        },
        joiners: []
      }
    ],
    content: state.content
  };

  const saved = await writeScienceProjectsState(nextState);
  return NextResponse.json({
    ...saved,
    message: `Submitted "${title}". Pending administrator announcement.`
  });
}
