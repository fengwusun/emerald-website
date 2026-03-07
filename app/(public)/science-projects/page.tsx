import {
  ANNOUNCED_SCIENCE_PROJECTS,
  SCIENCE_PROJECTS_PAGE_CONTENT
} from "@/lib/science-projects-catalog";

const SCIENCE_PROJECTS_SHEET_EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1mW5dj9LEOfNadKGAZFh_IJLjwfApueGboT_1S9Z8OCU/edit?gid=0#gid=0";
const SCIENCE_PROJECTS_SHEET_EMBED_URL =
  "https://docs.google.com/spreadsheets/d/1mW5dj9LEOfNadKGAZFh_IJLjwfApueGboT_1S9Z8OCU/preview?gid=0";

export default function ScienceProjectsPage() {
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
          style={{ width: "100%", minHeight: "760px", border: "1px solid #cbe6de", borderRadius: "10px" }}
        />
      </section>

      <section className="science-projects-grid">
        {ANNOUNCED_SCIENCE_PROJECTS.map((project) => (
          <article key={project.id} className="card science-project-card">
            <div className="science-project-card__header">
              <h2>{project.title}</h2>
            </div>

            <details className="science-project-card__details">
              <summary>Description</summary>
              <p>{project.description}</p>
            </details>

            <div className="science-project-card__meta">
              <p>
                <strong>Led by</strong>
                <span>{project.leadName}</span>
              </p>
              <p>
                <strong>Email</strong>
                <a href={`mailto:${project.leadEmail}`}>{project.leadEmail}</a>
              </p>
              <p>
                <strong>Recent Update Link</strong>
                {project.recentUpdateUrl ? (
                  <a href={project.recentUpdateUrl} target="_blank" rel="noreferrer">
                    {project.recentUpdateLabel || project.recentUpdateUrl}
                  </a>
                ) : (
                  <span className="muted">None</span>
                )}
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
