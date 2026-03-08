"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { withBasePath } from "@/lib/base-path";
import type { StoredRedshiftSubmission } from "@/lib/redshift-submissions-store";

const PAGE_SIZE_OPTIONS = new Set([25, 50, 100]);

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

export function RedshiftSubmissionsTable({ submissions }: { submissions: StoredRedshiftSubmission[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get("page") ?? "1");
  const pageSizeParam = Number(searchParams.get("pageSize") ?? "25");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.trunc(pageParam) : 1;
  const pageSize = PAGE_SIZE_OPTIONS.has(pageSizeParam) ? pageSizeParam : 25;

  const totalPages = Math.max(1, Math.ceil(submissions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const currentRows = useMemo(
    () => submissions.slice(start, start + pageSize),
    [submissions, start, pageSize]
  );

  const updateQuery = (nextPage: number, nextPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }
    if (nextPageSize !== 25) {
      params.set("pageSize", String(nextPageSize));
    } else {
      params.delete("pageSize");
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  return (
    <section className="card" style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", marginBottom: "0.7rem", flexWrap: "wrap" }}>
        <span className="muted">{submissions.length} submissions</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span className="muted">Rows</span>
          <select
            value={String(pageSize)}
            onChange={(event) => {
              const nextPageSize = Number(event.target.value);
              updateQuery(1, nextPageSize);
            }}
            style={{ width: "auto" }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
      </div>

      <table className="target-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>z_best</th>
            <th>Reporter</th>
            <th>Confidence</th>
            <th>Emission Lines</th>
            <th>Submitted (UTC)</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {currentRows.map((item) => (
            <tr key={item.id}>
              <td>
                {item.emerald_id ? (
                  <Link href={withBasePath(`/portal/targets/${item.emerald_id}`)}>
                    {item.source_name}
                  </Link>
                ) : (
                  item.source_name
                )}
                {item.emerald_id ? <div className="muted">{item.emerald_id}</div> : null}
              </td>
              <td>{item.z_best.toFixed(3)}</td>
              <td>{item.reporter_name || "-"}</td>
              <td>{item.confidence || "-"}</td>
              <td>{item.selected_line_ids.length > 0 ? item.selected_line_ids.join(", ") : "-"}</td>
              <td>{formatDate(item.submitted_at)}</td>
              <td>{item.comment || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.8rem" }}>
        <button
          className="secondary"
          disabled={safePage <= 1}
          onClick={() => updateQuery(Math.max(1, safePage - 1), pageSize)}
        >
          Previous
        </button>
        <span>
          Page {safePage} / {totalPages}
        </span>
        <button
          className="secondary"
          disabled={safePage >= totalPages}
          onClick={() => updateQuery(Math.min(totalPages, safePage + 1), pageSize)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
