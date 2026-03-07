import Link from "next/link";
import { readRedshiftSubmissions } from "@/lib/redshift-submissions-store";
import { withBasePath } from "@/lib/base-path";
import { RedshiftSubmissionsTable } from "@/components/redshift-submissions-table";

export const dynamic = "force-dynamic";

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
        <RedshiftSubmissionsTable submissions={submissions} />
      )}
    </div>
  );
}
