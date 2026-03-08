import { SCIENCE_PROJECTS_PAGE_CONTENT } from "@/lib/science-projects-catalog";
import { fetchScienceProjectsFromSheet } from "@/lib/google-sheets";

export const revalidate = 86400; // re-fetch every 24 hours

const SCIENCE_PROJECTS_SHEET_EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1mW5dj9LEOfNadKGAZFh_IJLjwfApueGboT_1S9Z8OCU/edit?gid=0#gid=0";
const SCIENCE_PROJECTS_SHEET_EMBED_URL =
  "https://docs.google.com/spreadsheets/d/1mW5dj9LEOfNadKGAZFh_IJLjwfApueGboT_1S9Z8OCU/preview?gid=0";

// ~50px per row in the embedded sheet + header/chrome overhead
const SHEET_ROW_HEIGHT = 50;
const SHEET_CHROME_HEIGHT = 100;
const SHEET_MIN_HEIGHT = 300;
const SHEET_MAX_HEIGHT = 760;

export default async function ScienceProjectsPage() {
  const projects = await fetchScienceProjectsFromSheet();
  const lastSync = new Date().toUTCString();

  // +2 accounts for the header row and the example/instruction rows
  const sheetRows = projects.length + 2;
  const computedHeight = Math.min(
    SHEET_MAX_HEIGHT,
    Math.max(SHEET_MIN_HEIGHT, sheetRows * SHEET_ROW_HEIGHT + SHEET_CHROME_HEIGHT)
  );

  return (
    <div className="grid">
      <section className="card hero">
        <h1>{SCIENCE_PROJECTS_PAGE_CONTENT.title}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          {SCIENCE_PROJECTS_PAGE_CONTENT.intro}
        </p>
      </section>

      <section className="card">
        <h2>Project Ideas Spreadsheet</h2>
        <p className="muted">
          Add your project ideas and interest directly in the shared Google Sheet.
          If the embedded view is limited by browser/login settings, use the direct edit link.
        </p>
        <p>
          <a href={SCIENCE_PROJECTS_SHEET_EDIT_URL} target="_blank" rel="noreferrer">
            Open Google Sheet (Edit)
          </a>
        </p>
        <iframe
          title="EMERALD+DIVER Science Projects Google Sheet"
          src={SCIENCE_PROJECTS_SHEET_EMBED_URL}
          style={{ width: "100%", height: `${computedHeight}px`, border: "1px solid #cbe6de", borderRadius: "10px" }}
        />
      </section>

      {projects.length > 0 && (
        <section className="science-projects-grid">
          <p className="muted" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
            The following project cards are automatically generated from the Google
            Sheet above. Our site re-fetches every 24 hours.{" "}
            <span style={{ fontSize: "0.82rem" }}>Last fetched: {lastSync}</span>
          </p>
          {projects.map((project) => (
            <article key={project.id} className="card science-project-card">
              <div className="science-project-card__header">
                <h2>{project.title}</h2>
              </div>

              {project.description && (
                <details className="science-project-card__details">
                  <summary>Description</summary>
                  <p>{project.description}</p>
                </details>
              )}

              <div className="science-project-card__meta">
                <p>
                  <strong>Led by</strong>
                  <span>{project.leadName}</span>
                </p>
                {project.dataset && (
                  <p>
                    <strong>Dataset</strong>
                    <span>{project.dataset}</span>
                  </p>
                )}
                {project.expectedTimeline && (
                  <p>
                    <strong>Timeline</strong>
                    <span>{project.expectedTimeline}</span>
                  </p>
                )}
                {project.interested && (
                  <p>
                    <strong>Interested</strong>
                    <span>{project.interested}</span>
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
