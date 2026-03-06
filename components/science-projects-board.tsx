"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

type CoiOption = {
  name: string;
  email: string;
};

type ProjectPerson = {
  name: string;
  email: string;
  updateLink: string;
  updateDate: string;
};

type ScienceProject = {
  id: string;
  title: string;
  abstract: string;
  announced: boolean;
  submitter: ProjectPerson | null;
  joiners: ProjectPerson[];
};

type JoinDraft = {
  name: string;
  updateLink: string;
};

type ProjectUpdate = {
  id: string;
  owner: "submitter" | "joiner";
  email: string;
  label: string;
  href: string;
};

type PageContent = {
  heroTitle: string;
  heroIntro: string;
  announcedHeading: string;
  submitHeading: string;
  submittedHeading: string;
};

type PersistedState = {
  projects: ScienceProject[];
  content: PageContent;
};

type ScienceProjectsApiResponse = PersistedState & {
  message?: string;
  isAdmin?: boolean;
  adminConfigured?: boolean;
  error?: string;
};

const STORAGE_KEY = "emerald-science-projects-v4";
const MEMBER_LIST_ID = "coi-member-options";

const DEFAULT_CONTENT: PageContent = {
  heroTitle: "Science Projects",
  heroIntro:
    "Browse announced EMERALD+DIVER science projects, join by selecting your Co-I name, and submit new projects with title, abstract, and contact details.",
  announcedHeading: "Announced Projects",
  submitHeading: "Submit a New Project",
  submittedHeading: "Submitted Projects (Pending Approval)"
};

const ANNOUNCED_PROJECTS: ScienceProject[] = [
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

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUpdateLink(value: string): string {
  return value.trim();
}

function nowIsoDate(): string {
  return new Date().toISOString();
}

function formatYYMMDD(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "--";
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidUpdateLink(value: string): boolean {
  if (!value) return true;
  return /^https?:\/\//i.test(value);
}

function sanitizePerson(person: ProjectPerson): ProjectPerson {
  const name = normalizeName(person.name);
  const email = person.email.trim().toLowerCase();
  const updateLink = normalizeUpdateLink(person.updateLink);
  const updateDate = person.updateDate || (updateLink ? nowIsoDate() : "");
  return { name, email, updateLink, updateDate };
}

function dedupePeople(people: ProjectPerson[]): ProjectPerson[] {
  const seen = new Set<string>();
  const output: ProjectPerson[] = [];

  for (const raw of people) {
    const person = sanitizePerson(raw);
    if (!person.name || !person.email) continue;
    if (seen.has(person.email)) continue;
    seen.add(person.email);
    output.push(person);
  }

  return output;
}

function parseSavedPerson(
  value: unknown,
  memberByName: Map<string, CoiOption>
): ProjectPerson | null {
  if (!value) return null;

  if (typeof value === "string") {
    const lookup = memberByName.get(normalizeName(value).toLowerCase());
    if (!lookup) return null;
    return { name: lookup.name, email: lookup.email, updateLink: "", updateDate: "" };
  }

  if (typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string") return null;

  const lookup = memberByName.get(normalizeName(raw.name).toLowerCase());
  const name = lookup?.name ?? raw.name;
  const emailFromRaw = typeof raw.email === "string" ? raw.email : "";
  const email = (lookup?.email ?? emailFromRaw).trim().toLowerCase();
  if (!email) return null;

  const updateLink = typeof raw.updateLink === "string" ? raw.updateLink : "";
  const updateDate =
    typeof raw.updateDate === "string" ? raw.updateDate : updateLink ? nowIsoDate() : "";

  return sanitizePerson({ name, email, updateLink, updateDate });
}

function parseSavedProject(
  value: unknown,
  memberByName: Map<string, CoiOption>
): ScienceProject | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.abstract !== "string" ||
    typeof candidate.announced !== "boolean" ||
    !Array.isArray(candidate.joiners)
  ) {
    return null;
  }

  const joiners = candidate.joiners
    .map((joiner) => parseSavedPerson(joiner, memberByName))
    .filter((person): person is ProjectPerson => person !== null);

  const submitter = parseSavedPerson(candidate.submitter, memberByName);

  return {
    id: candidate.id,
    title: candidate.title,
    abstract: candidate.abstract,
    announced: candidate.announced,
    submitter,
    joiners: dedupePeople(joiners)
  };
}

function parseSavedContent(value: unknown): PageContent {
  if (!value || typeof value !== "object") return DEFAULT_CONTENT;
  const raw = value as Record<string, unknown>;

  return {
    heroTitle:
      typeof raw.heroTitle === "string" ? raw.heroTitle : DEFAULT_CONTENT.heroTitle,
    heroIntro:
      typeof raw.heroIntro === "string" ? raw.heroIntro : DEFAULT_CONTENT.heroIntro,
    announcedHeading:
      typeof raw.announcedHeading === "string"
        ? raw.announcedHeading
        : DEFAULT_CONTENT.announcedHeading,
    submitHeading:
      typeof raw.submitHeading === "string"
        ? raw.submitHeading
        : DEFAULT_CONTENT.submitHeading,
    submittedHeading:
      typeof raw.submittedHeading === "string"
        ? raw.submittedHeading
        : DEFAULT_CONTENT.submittedHeading
  };
}

function uniqueEmails(project: ScienceProject): string[] {
  const emails: string[] = [];
  const seen = new Set<string>();

  if (project.submitter?.email) {
    seen.add(project.submitter.email);
    emails.push(project.submitter.email);
  }

  for (const joiner of project.joiners) {
    if (seen.has(joiner.email)) continue;
    seen.add(joiner.email);
    emails.push(joiner.email);
  }

  return emails;
}

function projectMailtoHref(project: ScienceProject): string | null {
  const emails = uniqueEmails(project);
  if (emails.length === 0) return null;

  const subject = encodeURIComponent(`[EMERALD+DIVER] ${project.title}`);
  return `mailto:${emails.join(",")}?subject=${subject}`;
}

function projectUpdates(project: ScienceProject): ProjectUpdate[] {
  const updates: ProjectUpdate[] = [];

  if (project.submitter?.updateLink) {
    updates.push({
      id: `submitter:${project.submitter.email}`,
      owner: "submitter",
      email: project.submitter.email,
      label: `updates from ${project.submitter.name} on ${formatYYMMDD(project.submitter.updateDate)}`,
      href: project.submitter.updateLink
    });
  }

  for (const joiner of project.joiners) {
    if (!joiner.updateLink) continue;
    updates.push({
      id: `joiner:${joiner.email}`,
      owner: "joiner",
      email: joiner.email,
      label: `updates from ${joiner.name} on ${formatYYMMDD(joiner.updateDate)}`,
      href: joiner.updateLink
    });
  }

  return updates;
}

function moveArrayItem<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function ScienceProjectsBoard({ members }: { members: CoiOption[] }) {
  const memberByName = useMemo(() => {
    const map = new Map<string, CoiOption>();
    for (const member of members) {
      map.set(normalizeName(member.name).toLowerCase(), {
        name: normalizeName(member.name),
        email: member.email.trim().toLowerCase()
      });
    }
    return map;
  }, [members]);

  const [projects, setProjects] = useState<ScienceProject[]>(ANNOUNCED_PROJECTS);
  const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT);
  const [joinDrafts, setJoinDrafts] = useState<Record<string, JoinDraft>>({});

  const [submitName, setSubmitName] = useState("");
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitUpdateLink, setSubmitUpdateLink] = useState("");
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitAbstract, setSubmitAbstract] = useState("");

  const [adminMode, setAdminMode] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminProjectTitle, setAdminProjectTitle] = useState("");
  const [adminProjectAbstract, setAdminProjectAbstract] = useState("");
  const [adminProjectAnnounced, setAdminProjectAnnounced] = useState(true);

  const [message, setMessage] = useState("");
  const [stateReady, setStateReady] = useState(false);

  const announcedProjects = useMemo(
    () => projects.filter((project) => project.announced),
    [projects]
  );
  const submittedProjects = useMemo(
    () => projects.filter((project) => !project.announced),
    [projects]
  );

  useEffect(() => {
    const matched = memberByName.get(normalizeName(submitName).toLowerCase());
    setSubmitEmail(matched?.email ?? "");
  }, [submitName, memberByName]);

  useEffect(() => {
    let mounted = true;

    async function loadInitialState() {
      let loadedProjects: ScienceProject[] | null = null;
      let loadedContent: PageContent | null = null;

      try {
        const response = await fetch("/api/science-projects", {
          method: "GET",
          cache: "no-store"
        });

        if (response.ok) {
          const parsed = (await response.json()) as ScienceProjectsApiResponse;
          const rawProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
          loadedProjects = rawProjects
            .map((item) => parseSavedProject(item, memberByName))
            .filter((item): item is ScienceProject => item !== null);
          loadedContent = parseSavedContent(parsed.content);
          setAdminAuthorized(Boolean(parsed.isAdmin));
          setAdminConfigured(Boolean(parsed.adminConfigured));
          setAdminMode(Boolean(parsed.isAdmin));
        }
      } catch {
        // Continue with local fallback/defaults below.
      }

      if (loadedProjects === null && typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              loadedProjects = parsed
                .map((item) => parseSavedProject(item, memberByName))
                .filter((item): item is ScienceProject => item !== null);
              loadedContent = DEFAULT_CONTENT;
            } else if (parsed && typeof parsed === "object") {
              const record = parsed as Record<string, unknown>;
              const rawProjects = Array.isArray(record.projects)
                ? record.projects
                : [];
              loadedProjects = rawProjects
                .map((item) => parseSavedProject(item, memberByName))
                .filter((item): item is ScienceProject => item !== null);
              loadedContent = parseSavedContent(record.content);
            }
          }
        } catch {
          // Ignore malformed local data and continue with defaults.
        }
      }

      if (!mounted) return;
      if (loadedProjects !== null) {
        setProjects(loadedProjects);
      }
      if (loadedContent) {
        setContent(loadedContent);
      }
      setStateReady(true);
    }

    void loadInitialState();
    return () => {
      mounted = false;
    };
  }, [memberByName]);

  useEffect(() => {
    if (!stateReady) return;

    const payload: PersistedState = { projects, content };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    if (!adminMode || !adminAuthorized) return;

    const timeout = window.setTimeout(() => {
      void fetch("/api/science-projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(async (response) => {
          if (response.status === 403) {
            setAdminMode(false);
            setAdminAuthorized(false);
            setMessage("Admin session expired. Please re-enter administration mode.");
          }
        })
        .catch(() => {
          setMessage("Failed to save admin changes to server.");
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [projects, content, stateReady, adminMode, adminAuthorized]);

  async function handleJoin(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();

    const draft = joinDrafts[projectId] ?? { name: "", updateLink: "" };
    const selectedName = normalizeName(draft.name);
    const selectedLink = normalizeUpdateLink(draft.updateLink);

    const member = memberByName.get(selectedName.toLowerCase());
    if (!member) {
      setMessage("Please select your name from the Co-I list.");
      return;
    }

    if (!isValidUpdateLink(selectedLink)) {
      setMessage("Update link must start with http:// or https://.");
      return;
    }

    try {
      const response = await fetch("/api/science-projects/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: member.name,
          updateLink: selectedLink
        })
      });

      const parsed = (await response.json().catch(() => null)) as
        | ScienceProjectsApiResponse
        | null;

      if (!response.ok) {
        setMessage(parsed?.error ?? "Failed to join project.");
        return;
      }

      if (Array.isArray(parsed?.projects)) {
        const cleanedProjects = parsed.projects
          .map((item) => parseSavedProject(item, memberByName))
          .filter((item): item is ScienceProject => item !== null);
        setProjects(cleanedProjects);
      }
      if (parsed?.content) {
        setContent(parseSavedContent(parsed.content));
      }

      setJoinDrafts((prev) => ({ ...prev, [projectId]: { name: "", updateLink: "" } }));
      setMessage(parsed?.message ?? `${member.name} joined.`);
    } catch {
      setMessage("Network error while joining project.");
    }
  }

  async function handleSubmitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const safeTitle = submitTitle.trim();
    const safeAbstract = submitAbstract.trim();
    const safeName = normalizeName(submitName);
    const safeUpdateLink = normalizeUpdateLink(submitUpdateLink);

    const member = memberByName.get(safeName.toLowerCase());

    if (!safeTitle || !safeAbstract || !safeName) {
      setMessage("Please provide project title, abstract, and submitter name.");
      return;
    }

    if (!member) {
      setMessage("Submitter name must be selected from the Co-I list.");
      return;
    }

    if (!isValidUpdateLink(safeUpdateLink)) {
      setMessage("Update link must start with http:// or https://.");
      return;
    }

    try {
      const response = await fetch("/api/science-projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: safeTitle,
          abstract: safeAbstract,
          name: member.name,
          updateLink: safeUpdateLink
        })
      });

      const parsed = (await response.json().catch(() => null)) as
        | ScienceProjectsApiResponse
        | null;

      if (!response.ok) {
        setMessage(parsed?.error ?? "Failed to submit project.");
        return;
      }

      if (Array.isArray(parsed?.projects)) {
        const cleanedProjects = parsed.projects
          .map((item) => parseSavedProject(item, memberByName))
          .filter((item): item is ScienceProject => item !== null);
        setProjects(cleanedProjects);
      }
      if (parsed?.content) {
        setContent(parseSavedContent(parsed.content));
      }

      setSubmitName("");
      setSubmitEmail("");
      setSubmitUpdateLink("");
      setSubmitTitle("");
      setSubmitAbstract("");
      setMessage(parsed?.message ?? `Submitted "${safeTitle}".`);
    } catch {
      setMessage("Network error while submitting project.");
    }
  }

  async function enterAdminMode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await fetch("/api/science-projects/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword })
      });

      const parsed = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setMessage(parsed?.error ?? "Unable to enter administration mode.");
        return;
      }

      setAdminMode(true);
      setAdminAuthorized(true);
      setAdminPassword("");
      setMessage("Administration mode enabled.");
    } catch {
      setMessage("Network error while enabling administration mode.");
    }
  }

  async function exitAdminMode() {
    try {
      await fetch("/api/science-projects/admin/logout", {
        method: "POST"
      });
    } catch {
      // Best effort logout.
    }

    setAdminMode(false);
    setAdminAuthorized(false);
    setShowAdminPanel(false);
    setMessage("Administration mode disabled.");
  }

  function moveProjectWithinSection(projectId: string, direction: -1 | 1) {
    setProjects((prev) => {
      const currentIndex = prev.findIndex((project) => project.id === projectId);
      if (currentIndex < 0) return prev;

      const targetStatus = prev[currentIndex].announced;
      const groupIndices = prev
        .map((project, index) => ({ project, index }))
        .filter((item) => item.project.announced === targetStatus)
        .map((item) => item.index);

      const groupPosition = groupIndices.indexOf(currentIndex);
      const nextPosition = groupPosition + direction;
      if (nextPosition < 0 || nextPosition >= groupIndices.length) return prev;

      return moveArrayItem(prev, currentIndex, groupIndices[nextPosition]);
    });
  }

  function toggleProjectSection(projectId: string) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, announced: !project.announced } : project
      )
    );
  }

  function deleteProject(projectId: string) {
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
  }

  function addAdminProject() {
    const title = adminProjectTitle.trim();
    const abstract = adminProjectAbstract.trim();
    if (!title || !abstract) {
      setMessage("Admin add project requires both title and abstract.");
      return;
    }

    const newProject: ScienceProject = {
      id: createId("admin"),
      title,
      abstract,
      announced: adminProjectAnnounced,
      submitter: null,
      joiners: []
    };

    setProjects((prev) => [...prev, newProject]);
    setAdminProjectTitle("");
    setAdminProjectAbstract("");
    setMessage("Project block added.");
  }

  function deleteProjectUpdate(projectId: string, update: ProjectUpdate) {
    if (!adminMode) {
      setMessage("Enter administration mode first.");
      return;
    }

    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        if (update.owner === "submitter") {
          if (!project.submitter || project.submitter.email !== update.email) return project;
          return {
            ...project,
            submitter: { ...project.submitter, updateLink: "", updateDate: "" }
          };
        }

        return {
          ...project,
          joiners: project.joiners.map((joiner) =>
            joiner.email === update.email ? { ...joiner, updateLink: "", updateDate: "" } : joiner
          )
        };
      })
    );

    setMessage("Recent update link deleted.");
  }

  function renderProjectCard(project: ScienceProject, showJoinForm: boolean) {
    const joinDraft = joinDrafts[project.id] ?? { name: "", updateLink: "" };
    const mailto = projectMailtoHref(project);
    const updates = projectUpdates(project);

    return (
      <article className="card project-card" key={project.id}>
        <h3>{project.title}</h3>
        <p>{project.abstract}</p>

        {adminMode ? (
          <div className="project-admin-edit">
            <label>
              Edit Title
              <input
                value={project.title}
                onChange={(event) => {
                  const value = event.target.value;
                  setProjects((prev) =>
                    prev.map((item) => (item.id === project.id ? { ...item, title: value } : item))
                  );
                }}
              />
            </label>
            <label>
              Edit Abstract
              <textarea
                rows={4}
                value={project.abstract}
                onChange={(event) => {
                  const value = event.target.value;
                  setProjects((prev) =>
                    prev.map((item) => (item.id === project.id ? { ...item, abstract: value } : item))
                  );
                }}
              />
            </label>
            <div className="project-admin-actions">
              <button type="button" className="secondary" onClick={() => toggleProjectSection(project.id)}>
                Move to {project.announced ? "Submitted" : "Announced"}
              </button>
              <button type="button" className="secondary" onClick={() => moveProjectWithinSection(project.id, -1)}>
                Move Up
              </button>
              <button type="button" className="secondary" onClick={() => moveProjectWithinSection(project.id, 1)}>
                Move Down
              </button>
              <button type="button" className="secondary" onClick={() => deleteProject(project.id)}>
                Delete Project
              </button>
            </div>
          </div>
        ) : null}

        {project.submitter ? (
          <p className="muted">
            Submitter: {project.submitter.name} ({project.submitter.email})
          </p>
        ) : null}

        <p className="muted">
          Joined: {project.joiners.length > 0 ? project.joiners.map((j) => j.name).join(", ") : "No one yet"}
        </p>

        {mailto ? (
          <p>
            <a href={mailto}>Email Participants</a>
          </p>
        ) : (
          <p className="muted">Email Participants: available after people join.</p>
        )}

        {updates.length > 0 ? (
          <div className="project-links">
            <strong>Recent Updates</strong>
            <ul>
              {updates.map((update) => (
                <li key={`${project.id}-${update.id}`}>
                  <a href={update.href} target="_blank" rel="noreferrer">
                    {update.label}
                  </a>
                  {adminMode ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => deleteProjectUpdate(project.id, update)}
                      style={{ marginLeft: "0.6rem", padding: "0.2rem 0.55rem" }}
                    >
                      Delete Update
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">No recent update links shared yet.</p>
        )}

        {showJoinForm ? (
          <form className="project-join-form" onSubmit={(event) => void handleJoin(event, project.id)}>
            <div className="project-join-fields">
              <label>
                Join Name
                <input
                  list={MEMBER_LIST_ID}
                  value={joinDraft.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setJoinDrafts((prev) => ({
                      ...prev,
                      [project.id]: { ...joinDraft, name: value }
                    }));
                  }}
                  placeholder="Select your name"
                />
              </label>
              <label>
                Recent Update Link (optional)
                <input
                  value={joinDraft.updateLink}
                  onChange={(event) => {
                    const value = event.target.value;
                    setJoinDrafts((prev) => ({
                      ...prev,
                      [project.id]: { ...joinDraft, updateLink: value }
                    }));
                  }}
                  placeholder="https://docs.google.com/..."
                />
              </label>
            </div>
            <button type="submit">Join / Update Link</button>
          </form>
        ) : null}
      </article>
    );
  }

  return (
    <div className="grid">
      <section className="hero">
        <h1>{content.heroTitle}</h1>
        <p>{content.heroIntro}</p>
      </section>

      {message ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            {message}
          </p>
        </section>
      ) : null}

      <section className="grid">
        <h2>{content.announcedHeading}</h2>
        <div className="grid grid-2">{announcedProjects.map((project) => renderProjectCard(project, true))}</div>
      </section>

      <section className="card">
        <h2>{content.submitHeading}</h2>
        <form className="grid" onSubmit={(event) => void handleSubmitProject(event)}>
          <label>
            Submitter Name
            <input
              list={MEMBER_LIST_ID}
              value={submitName}
              onChange={(event) => setSubmitName(event.target.value)}
              placeholder="Select your name"
            />
          </label>
          <label>
            Submitter Email
            <input value={submitEmail} readOnly placeholder="Auto-filled from Co-I directory" />
          </label>
          <label>
            Recent Update Link (optional)
            <input
              value={submitUpdateLink}
              onChange={(event) => setSubmitUpdateLink(event.target.value)}
              placeholder="https://overleaf.com/..."
            />
          </label>
          <label>
            Project Title
            <input
              value={submitTitle}
              onChange={(event) => setSubmitTitle(event.target.value)}
              placeholder="e.g., AGN-driven outflows at cosmic dawn"
            />
          </label>
          <label>
            Abstract
            <textarea
              rows={5}
              value={submitAbstract}
              onChange={(event) => setSubmitAbstract(event.target.value)}
              placeholder="Describe the science question, method, and expected result."
            />
          </label>
          <div>
            <button type="submit">Submit Project</button>
          </div>
        </form>
      </section>

      {submittedProjects.length > 0 ? (
        <section className="grid">
          <h2>{content.submittedHeading}</h2>
          <div className="grid grid-2">{submittedProjects.map((project) => renderProjectCard(project, true))}</div>
        </section>
      ) : null}

      {showAdminPanel ? (
        <section className="card admin-panel">
          {!adminMode ? (
            <form className="project-admin-form" onSubmit={(event) => void enterAdminMode(event)}>
              <label>
                Administration Password
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Enter password"
                  disabled={!adminConfigured}
                />
              </label>
              {!adminConfigured ? (
                <p className="notice" style={{ margin: 0 }}>
                  Admin mode is not configured on the server.
                </p>
              ) : null}
              <div>
                <button type="submit" className="secondary" disabled={!adminConfigured}>
                  Enter Administration Mode
                </button>
              </div>
            </form>
          ) : (
            <div className="grid" style={{ gap: "0.9rem" }}>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                <strong>Administration mode is active.</strong>
                <button type="button" className="secondary" onClick={() => void exitAdminMode()}>
                  Exit Administration Mode
                </button>
              </div>

              <section className="card" style={{ boxShadow: "none" }}>
                <h3>Add Project Block</h3>
                <div className="grid">
                  <label>
                    Title
                    <input
                      value={adminProjectTitle}
                      onChange={(event) => setAdminProjectTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    Abstract
                    <textarea
                      rows={3}
                      value={adminProjectAbstract}
                      onChange={(event) => setAdminProjectAbstract(event.target.value)}
                    />
                  </label>
                  <label>
                    Section
                    <select
                      value={adminProjectAnnounced ? "announced" : "submitted"}
                      onChange={(event) => setAdminProjectAnnounced(event.target.value === "announced")}
                    >
                      <option value="announced">Announced</option>
                      <option value="submitted">Submitted</option>
                    </select>
                  </label>
                  <div>
                    <button type="button" className="secondary" onClick={addAdminProject}>
                      Add Project
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </section>
      ) : null}

      <section className="admin-footer">
        <button
          type="button"
          className="secondary admin-mini-button"
          onClick={() => setShowAdminPanel((prev) => !prev)}
        >
          {showAdminPanel ? "Hide Admin" : "Administration Mode"}
        </button>
        {adminMode ? (
          <button
            type="button"
            className="secondary admin-mini-button"
            onClick={() => void exitAdminMode()}
          >
            Exit Admin Mode
          </button>
        ) : null}
      </section>

      <datalist id={MEMBER_LIST_ID}>
        {members.map((member) => (
          <option key={member.email} value={member.name} />
        ))}
      </datalist>
    </div>
  );
}
