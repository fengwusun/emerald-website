import fs from "node:fs/promises";
import path from "node:path";

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

export async function readScienceProjectsState(): Promise<StoredScienceProjectsState> {
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

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });

  const tempPath = `${STORE_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(normalized, null, 2), "utf-8");
  await fs.rename(tempPath, STORE_PATH);

  return normalized;
}
