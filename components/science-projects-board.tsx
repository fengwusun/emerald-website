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

type PageTextBlock = {
  id: string;
  title: string;
  body: string;
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

const STORAGE_KEY = "emerald-science-projects-v4";
const MEMBER_LIST_ID = "coi-member-options";
const ADMIN_PASSWORD = "westlakebiggestsun";

const DEFAULT_CONTENT: PageContent = {
  heroTitle: "Science Projects",
  heroIntro:
    "Browse announced EMERALD science projects, join by selecting your Co-I name, and submit new projects with title, abstract, and contact details.",
  announcedHeading: "Announced Projects",
  submitHeading: "Submit a New Project",
  submittedHeading: "Submitted Projects (Pending Approval)"
};

const ANNOUNCED_PROJECTS: ScienceProject[] = [
  {
    id: "agn-incidence-z4-9",
    title: "AGN Incidence Across z = 4-9",
    abstract:
      "Measure AGN incidence in the EMERALD galaxy sample using rest-optical diagnostics and broad-line indicators.",
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

function mergeWithAnnounced(savedProjects: ScienceProject[]): ScienceProject[] {
  const announcedById = new Map(ANNOUNCED_PROJECTS.map((project) => [project.id, project]));
  const cleanedSaved = savedProjects.map((project) => ({
    ...project,
    submitter: project.submitter ? sanitizePerson(project.submitter) : null,
    joiners: dedupePeople(project.joiners)
  }));

  const mergedAnnounced = ANNOUNCED_PROJECTS.map((project) => {
    const persisted = cleanedSaved.find((candidate) => candidate.id === project.id);
    if (!persisted) return project;

    return {
      ...project,
      submitter: persisted.submitter,
      joiners: dedupePeople([...project.joiners, ...persisted.joiners])
    };
  });

  const customProjects = cleanedSaved.filter((project) => !announcedById.has(project.id));
  return [...mergedAnnounced, ...customProjects];
}

function parseSavedPerson(value: unknown, memberByName: Map<string, CoiOption>): ProjectPerson | null {
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
  const updateDate = typeof raw.updateDate === "string" ? raw.updateDate : updateLink ? nowIsoDate() : "";

  return sanitizePerson({ name, email, updateLink, updateDate });
}

function parseSavedProject(value: unknown, memberByName: Map<string, CoiOption>): ScienceProject | null {
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
    heroTitle: typeof raw.heroTitle === "string" ? raw.heroTitle : DEFAULT_CONTENT.heroTitle,
    heroIntro: typeof raw.heroIntro === "string" ? raw.heroIntro : DEFAULT_CONTENT.heroIntro,
    announcedHeading: typeof raw.announcedHeading === "string" ? raw.announcedHeading : DEFAULT_CONTENT.announcedHeading,
    submitHeading: typeof raw.submitHeading === "string" ? raw.submitHeading : DEFAULT_CONTENT.submitHeading,
    submittedHeading:
      typeof raw.submittedHeading === "string" ? raw.submittedHeading : DEFAULT_CONTENT.submittedHeading
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

  const subject = encodeURIComponent(`[EMERALD] ${project.title}`);
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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminProjectTitle, setAdminProjectTitle] = useState("");
  const [adminProjectAbstract, setAdminProjectAbstract] = useState("");
  const [adminProjectAnnounced, setAdminProjectAnnounced] = useState(true);

  const [message, setMessage] = useState("");
  const [storageReady, setStorageReady] = useState(false);

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
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStorageReady(true);
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleanedProjects = parsed
          .map((item) => parseSavedProject(item, memberByName))
          .filter((item): item is ScienceProject => item !== null);
        setProjects(mergeWithAnnounced(cleanedProjects));
        setContent(DEFAULT_CONTENT);
      } else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const rawProjects = Array.isArray(record.projects) ? record.projects : [];
        const cleanedProjects = rawProjects
          .map((item) => parseSavedProject(item, memberByName))
          .filter((item): item is ScienceProject => item !== null);

        setProjects(mergeWithAnnounced(cleanedProjects));
        setContent(parseSavedContent(record.content));
      }
    } catch {
      // Ignore malformed local data and continue with defaults.
    } finally {
      setStorageReady(true);
    }
  }, [memberByName]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;

    const payload: PersistedState = {
      projects,
      content
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [projects, content, storageReady]);

  function handleJoin(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();

    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

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

    const existing = project.joiners.find((joiner) => joiner.email === member.email);

    if (existing) {
      if (!selectedLink || existing.updateLink === selectedLink) {
        setMessage(`${member.name} is already joined for this project.`);
        return;
      }

      setProjects((prev) =>
        prev.map((item) => {
          if (item.id !== projectId) return item;
          return {
            ...item,
            joiners: item.joiners.map((joiner) =>
              joiner.email === member.email
                ? { ...joiner, updateLink: selectedLink, updateDate: nowIsoDate() }
                : joiner
            )
          };
        })
      );
      setMessage(`Updated recent link for ${member.name}.`);
      return;
    }

    setProjects((prev) =>
      prev.map((item) =>
        item.id === projectId
          ? {
              ...item,
              joiners: [
                ...item.joiners,
                {
                  name: member.name,
                  email: member.email,
                  updateLink: selectedLink,
                  updateDate: selectedLink ? nowIsoDate() : ""
                }
              ]
            }
          : item
      )
    );

    setJoinDrafts((prev) => ({ ...prev, [projectId]: { name: "", updateLink: "" } }));
    setMessage(`${member.name} joined \"${project.title}\".`);
  }

  function handleSubmitProject(event: FormEvent<HTMLFormElement>) {
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

    const newProject: ScienceProject = {
      id: createId("submitted"),
      title: safeTitle,
      abstract: safeAbstract,
      announced: false,
      submitter: {
        name: member.name,
        email: member.email,
        updateLink: safeUpdateLink,
        updateDate: safeUpdateLink ? nowIsoDate() : ""
      },
      joiners: []
    };

    setProjects((prev) => [...prev, newProject]);
    setSubmitName("");
    setSubmitEmail("");
    setSubmitUpdateLink("");
    setSubmitTitle("");
    setSubmitAbstract("");
    setMessage(`Submitted \"${safeTitle}\". Pending administrator announcement.`);
  }

  function enterAdminMode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (adminPassword !== ADMIN_PASSWORD) {
      setMessage("Incorrect administration password.");
      return;
    }

    setAdminMode(true);
    setAdminPassword("");
    setMessage("Administration mode enabled.");
  }

  function exitAdminMode() {
    setAdminMode(false);
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
        {adminMode ? (
          <div className="project-admin-edit">
            <label>
              Project Title
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
              Project Abstract
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
        ) : (
          <>
            <h3>{project.title}</h3>
            <p>{project.abstract}</p>
          </>
        )}

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
          <form className="project-join-form" onSubmit={(event) => handleJoin(event, project.id)}>
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
        <form className="grid" onSubmit={handleSubmitProject}>
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
            <form className="project-admin-form" onSubmit={enterAdminMode}>
              <label>
                Administration Password
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Enter password"
                />
              </label>
              <div>
                <button type="submit" className="secondary">
                  Enter Administration Mode
                </button>
              </div>
            </form>
          ) : (
            <div className="grid" style={{ gap: "0.9rem" }}>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                <strong>Administration mode is active.</strong>
                <button type="button" className="secondary" onClick={exitAdminMode}>
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
            onClick={exitAdminMode}
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
