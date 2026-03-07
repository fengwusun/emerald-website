"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const pageParam = Number(searchParams.get("page") ?? "1");
    const pageSizeParam = Number(searchParams.get("pageSize") ?? "25");
    setPage(Number.isFinite(pageParam) && pageParam > 0 ? Math.trunc(pageParam) : 1);
    setPageSize(PAGE_SIZE_OPTIONS.has(pageSizeParam) ? pageSizeParam : 25);
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(submissions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const currentRows = useMemo(
    () => submissions.slice(start, start + pageSize),
    [submissions, start, pageSize]
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (safePage > 1) {
      params.set("page", String(safePage));
    } else {
      params.delete("page");
    }
    if (pageSize !== 25) {
      params.set("pageSize", String(pageSize));
    } else {
      params.delete("pageSize");
    }
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [safePage, pageSize, pathname, router, searchParams]);

  return (
    <section className="card" style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", marginBottom: "0.7rem", flexWrap: "wrap" }}>
        <span className="muted">{submissions.length} submissions</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span className="muted">Rows</span>
          <select
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
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
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span>
          Page {safePage} / {totalPages}
        </span>
        <button
          className="secondary"
          disabled={safePage >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>
    </section>
  );
}
