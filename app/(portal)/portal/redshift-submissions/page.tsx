import Link from "next/link";
import { readRedshiftSubmissions } from "@/lib/redshift-submissions-store";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  });
}

export default async function RedshiftSubmissionsPage() {
  const submissions = await readRedshiftSubmissions();

  return (
    <div className="grid">
      <h1>Redshift Reports</h1>
      <p className="muted">
        Append-only user submissions from the interactive spectrum viewer. Times shown in UTC.
      </p>
      <p>
        <Link href={withBasePath("/portal/targets")}>← Back to target catalog</Link>
      </p>

      {submissions.length === 0 ? (
        <section className="card">
          <p className="muted">No redshift submissions yet.</p>
        </section>
      ) : (
        <section className="card" style={{ overflowX: "auto" }}>
          <table className="target-table">
            <thead>
              <tr>
                <th>Submitted (UTC)</th>
                <th>Source</th>
                <th>z_best</th>
                <th>Reporter</th>
                <th>Confidence</th>
                <th>Lines</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.submitted_at)}</td>
                  <td>
                    {item.source_name}
                    {item.emerald_id ? <div className="muted">{item.emerald_id}</div> : null}
                  </td>
                  <td>{item.z_best.toFixed(3)}</td>
                  <td>
                    {item.reporter_name || "Anonymous"}
                    {item.reporter_email ? <div className="muted">{item.reporter_email}</div> : null}
                  </td>
                  <td>{item.confidence || "-"}</td>
                  <td>{item.selected_line_ids.length > 0 ? item.selected_line_ids.join(", ") : "-"}</td>
                  <td>{item.comment || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
