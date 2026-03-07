import { NextResponse } from "next/server";
import { loadCoiMembers } from "@/lib/data";
import {
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
        projectId?: unknown;
        name?: unknown;
        updateLink?: unknown;
      }
    | null;

  const projectId =
    typeof payload?.projectId === "string" ? payload.projectId : "";
  const name =
    typeof payload?.name === "string" ? normalizeName(payload.name) : "";
  const updateLink =
    typeof payload?.updateLink === "string"
      ? normalizeUpdateLink(payload.updateLink)
      : "";

  if (!projectId || !name) {
    return NextResponse.json(
      { error: "Project and joiner name are required." },
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
      { error: "Please select your name from the Co-I list." },
      { status: 400 }
    );
  }

  const email = member.email.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Selected member does not have an email in the Co-I list yet." },
      { status: 400 }
    );
  }

  const state = await readScienceProjectsState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const existing = project.joiners.find((joiner) => joiner.email === email);

  if (existing && (!updateLink || existing.updateLink === updateLink)) {
    return NextResponse.json({
      ...state,
      message: `${member.name} is already joined for this project.`
    });
  }

  const nextProjects = state.projects.map((item) => {
    if (item.id !== projectId) return item;

    if (existing) {
      return {
        ...item,
        joiners: item.joiners.map((joiner) =>
          joiner.email === email
            ? { ...joiner, updateLink, updateDate: nowIsoDate() }
            : joiner
        )
      };
    }

    return {
      ...item,
      joiners: [
        ...item.joiners,
        {
          name: member.name,
          email,
          updateLink,
          updateDate: updateLink ? nowIsoDate() : ""
        }
      ]
    };
  });

  const saved = await writeScienceProjectsState({
    projects: nextProjects,
    content: state.content
  });

  return NextResponse.json({
    ...saved,
    message: existing
      ? `Updated recent link for ${member.name}.`
      : `${member.name} joined "${project.title}".`
  });
}
