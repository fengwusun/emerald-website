import {
  ANNOUNCED_SCIENCE_PROJECTS,
  SCIENCE_PROJECTS_PAGE_CONTENT
} from "@/lib/science-projects-catalog";

export default function ScienceProjectsPage() {
  return (
    <div className="grid">
      <section className="card hero">
        <h1>{SCIENCE_PROJECTS_PAGE_CONTENT.title}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          {SCIENCE_PROJECTS_PAGE_CONTENT.intro}
        </p>
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
