import fs from "node:fs/promises";
import path from "node:path";
import {
  clearGoogleSheetRanges,
  getScienceProjectsGoogleSheetsRanges,
  isScienceProjectsGoogleSheetsConfigured,
  readGoogleSheetValues,
  updateGoogleSheetValues
} from "@/lib/google-sheets";

export type StoredProjectPerson = {
  name: string;
  email: string;
  updateLink: string;
  updateDate: string;
};

export type StoredScienceProject = {
  id: string;
  title: string;
  abstract: string;
  announced: boolean;
  submitter: StoredProjectPerson | null;
  joiners: StoredProjectPerson[];
};

export type StoredPageContent = {
  heroTitle: string;
  heroIntro: string;
  announcedHeading: string;
  submitHeading: string;
  submittedHeading: string;
};

export type StoredScienceProjectsState = {
  projects: StoredScienceProject[];
  content: StoredPageContent;
};

const STORE_PATH = path.join(process.cwd(), "data", "science-projects-state.json");
const PROJECTS_HEADER = [
  "id",
  "title",
  "abstract",
  "announced",
  "submitter_name",
  "submitter_email",
  "submitter_update_link",
  "submitter_update_date",
  "joiners_json"
] as const;
const CONTENT_HEADER = ["key", "value"] as const;

export const DEFAULT_SCIENCE_PROJECTS_CONTENT: StoredPageContent = {
  heroTitle: "Science Projects",
  heroIntro:
    "Browse announced EMERALD+DIVER science projects, join by selecting your Co-I name, and submit new projects with title, abstract, and contact details.",
  announcedHeading: "Announced Projects",
  submitHeading: "Submit a New Project",
  submittedHeading: "Submitted Projects (Pending Approval)"
};

export const DEFAULT_ANNOUNCED_PROJECTS: StoredScienceProject[] = [
  {
    id: "agn-incidence-z4-9",
    title: "AGN Incidence Across z = 4-9",
    abstract:
      "Measure AGN incidence in the EMERALD+DIVER galaxy sample using rest-optical diagnostics and broad-line indicators.",
    announced: true,
    submitter: null,
    joiners: []
  },
  {
    id: "line-ratio-evolution",
    title: "Emission-Line Ratio Evolution",
    abstract:
      "Track how key emission-line ratios evolve with redshift and connect ionization conditions to host-galaxy properties.",
    announced: true,
    submitter: null,
    joiners: []
  },
  {
    id: "host-nucleus-connection",
    title: "Host Galaxy and Nuclear Activity Connection",
    abstract:
      "Link AGN signatures with stellar mass growth, star-formation activity, and morphology in deep legacy fields.",
    announced: true,
    submitter: null,
    joiners: []
  }
];

export function nowIsoDate(): string {
  return new Date().toISOString();
}

export function createProjectId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parsePerson(value: unknown): StoredProjectPerson | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (!isString(raw.name) || !isString(raw.email)) return null;

  return {
    name: raw.name,
    email: raw.email,
    updateLink: isString(raw.updateLink) ? raw.updateLink : "",
    updateDate: isString(raw.updateDate) ? raw.updateDate : ""
  };
}

function parseProject(value: unknown): StoredScienceProject | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    !isString(raw.id) ||
    !isString(raw.title) ||
    !isString(raw.abstract) ||
    typeof raw.announced !== "boolean" ||
    !Array.isArray(raw.joiners)
  ) {
    return null;
  }

  const joiners = raw.joiners
    .map((joiner) => parsePerson(joiner))
    .filter((joiner): joiner is StoredProjectPerson => joiner !== null);

  return {
    id: raw.id,
    title: raw.title,
    abstract: raw.abstract,
    announced: raw.announced,
    submitter: parsePerson(raw.submitter),
    joiners
  };
}

function parseContent(value: unknown): StoredPageContent {
  if (!value || typeof value !== "object") return DEFAULT_SCIENCE_PROJECTS_CONTENT;
  const raw = value as Record<string, unknown>;

  return {
    heroTitle: isString(raw.heroTitle)
      ? raw.heroTitle
      : DEFAULT_SCIENCE_PROJECTS_CONTENT.heroTitle,
    heroIntro: isString(raw.heroIntro)
      ? raw.heroIntro
      : DEFAULT_SCIENCE_PROJECTS_CONTENT.heroIntro,
    announcedHeading: isString(raw.announcedHeading)
      ? raw.announcedHeading
      : DEFAULT_SCIENCE_PROJECTS_CONTENT.announcedHeading,
    submitHeading: isString(raw.submitHeading)
      ? raw.submitHeading
      : DEFAULT_SCIENCE_PROJECTS_CONTENT.submitHeading,
    submittedHeading: isString(raw.submittedHeading)
      ? raw.submittedHeading
      : DEFAULT_SCIENCE_PROJECTS_CONTENT.submittedHeading
  };
}

function defaultState(): StoredScienceProjectsState {
  return {
    projects: DEFAULT_ANNOUNCED_PROJECTS.map((project) => ({
      ...project,
      submitter: project.submitter ? { ...project.submitter } : null,
      joiners: project.joiners.map((joiner) => ({ ...joiner }))
    })),
    content: { ...DEFAULT_SCIENCE_PROJECTS_CONTENT }
  };
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseProjectsRows(rows: string[][]): StoredScienceProject[] {
  const dataRows =
    rows.length > 0 && rows[0].join("|") === PROJECTS_HEADER.join("|") ? rows.slice(1) : rows;

  return dataRows
    .map((row) => {
      const [
        id = "",
        title = "",
        abstract = "",
        announced = "",
        submitterName = "",
        submitterEmail = "",
        submitterUpdateLink = "",
        submitterUpdateDate = "",
        joinersJson = "[]"
      ] = row;

      let joiners: StoredProjectPerson[] = [];
      try {
        const parsed = JSON.parse(joinersJson);
        if (Array.isArray(parsed)) {
          joiners = parsed
            .map((person) => parsePerson(person))
            .filter((person): person is StoredProjectPerson => person !== null);
        }
      } catch {
        joiners = [];
      }

      const submitter =
        submitterName && submitterEmail
          ? parsePerson({
              name: submitterName,
              email: submitterEmail,
              updateLink: submitterUpdateLink,
              updateDate: submitterUpdateDate
            })
          : null;

      return parseProject({
        id,
        title,
        abstract,
        announced: parseBoolean(announced),
        submitter,
        joiners
      });
    })
    .filter((project): project is StoredScienceProject => project !== null);
}

function serializeProjectsRows(projects: StoredScienceProject[]): string[][] {
  return [
    [...PROJECTS_HEADER],
    ...projects.map((project) => [
      project.id,
      project.title,
      project.abstract,
      String(project.announced),
      project.submitter?.name ?? "",
      project.submitter?.email ?? "",
      project.submitter?.updateLink ?? "",
      project.submitter?.updateDate ?? "",
      JSON.stringify(project.joiners)
    ])
  ];
}

function parseContentRows(rows: string[][]): StoredPageContent {
  const dataRows =
    rows.length > 0 && rows[0].join("|") === CONTENT_HEADER.join("|") ? rows.slice(1) : rows;

  const record: Record<string, string> = {};
  for (const [key = "", value = ""] of dataRows) {
    if (!key) continue;
    record[key] = value;
  }

  return parseContent(record);
}

function serializeContentRows(content: StoredPageContent): string[][] {
  return [
    [...CONTENT_HEADER],
    ["heroTitle", content.heroTitle],
    ["heroIntro", content.heroIntro],
    ["announcedHeading", content.announcedHeading],
    ["submitHeading", content.submitHeading],
    ["submittedHeading", content.submittedHeading]
  ];
}

async function readScienceProjectsStateFromGoogleSheets(): Promise<StoredScienceProjectsState> {
  const ranges = getScienceProjectsGoogleSheetsRanges();
  if (!ranges) {
    throw new Error("Google Sheets storage is not configured.");
  }

  const [projectRows, contentRows] = await Promise.all([
    readGoogleSheetValues(ranges.projectsRange),
    readGoogleSheetValues(ranges.contentRange)
  ]);

  const projects = parseProjectsRows(projectRows);
  const content = parseContentRows(contentRows);

  if (projects.length === 0 && contentRows.length === 0) {
    return defaultState();
  }

  return { projects, content };
}

async function writeScienceProjectsStateToGoogleSheets(
  normalized: StoredScienceProjectsState
): Promise<StoredScienceProjectsState> {
  const ranges = getScienceProjectsGoogleSheetsRanges();
  if (!ranges) {
    throw new Error("Google Sheets storage is not configured.");
  }

  await clearGoogleSheetRanges([ranges.projectsRange, ranges.contentRange]);
  await Promise.all([
    updateGoogleSheetValues(ranges.projectsRange, serializeProjectsRows(normalized.projects)),
    updateGoogleSheetValues(ranges.contentRange, serializeContentRows(normalized.content))
  ]);

  return normalized;
}

export async function readScienceProjectsState(): Promise<StoredScienceProjectsState> {
  if (isScienceProjectsGoogleSheetsConfigured()) {
    return readScienceProjectsStateFromGoogleSheets();
  }

  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return defaultState();
    }

    const record = parsed as Record<string, unknown>;
    const projectsRaw = Array.isArray(record.projects) ? record.projects : [];
    const projects = projectsRaw
      .map((project) => parseProject(project))
      .filter((project): project is StoredScienceProject => project !== null);
    const content = parseContent(record.content);

    return { projects, content };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultState();
    }
    return defaultState();
  }
}

export async function writeScienceProjectsState(payload: {
  projects: unknown[];
  content: unknown;
}): Promise<StoredScienceProjectsState> {
  const normalized: StoredScienceProjectsState = {
    projects: payload.projects
      .map((project) => parseProject(project))
      .filter((project): project is StoredScienceProject => project !== null),
    content: parseContent(payload.content)
  };

  if (isScienceProjectsGoogleSheetsConfigured()) {
    return writeScienceProjectsStateToGoogleSheets(normalized);
  }

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });

  const tempPath = `${STORE_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(normalized, null, 2), "utf-8");
  await fs.rename(tempPath, STORE_PATH);

  return normalized;
}
