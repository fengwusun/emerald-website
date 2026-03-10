import Link from "next/link";
import { withBasePath } from "@/lib/base-path";

export default function PortalHomePage() {
  return (
    <div className="grid">
      <h1>EMERALD+DIVER Team Portal</h1>
      <section className="card">
        <p>
          Use the portal to search cross-program targets and inspect per-object
          metadata plus ancillary previews.
        </p>
        <p style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", margin: 0 }}>
          <Link href={withBasePath("/portal/targets")}>Go to Target Catalog</Link>
          <a href={withBasePath("/api/targets/catalog/download")}>Download Latest Target Catalog (CSV)</a>
          <a href={withBasePath("/api/linefits/download")}>Download Best-fit Line Table (CSV)</a>
        </p>
      </section>

      <section className="card">
        <h2>News</h2>
        <ul>
          <li>
            <strong>Mar 2026</strong> — Yongda Zhu reduced and released the
            spectra from DIVER Obs 1 (G140M/F070LP grating, 2 masks,
            ~20.6 h per mask, 260 sources in total) and Obs 2 (PRISM/CLEAR,
            2 masks, ~2.33 h per mask, 416 sources in total).
            spectra are available in the{" "}
            <Link href={withBasePath("/portal/targets")}>Target Catalog</Link>
            {" "}and the{" "}
            <Link href={withBasePath("/portal/spectra")}>Quick Interactive</Link>
            {" "}viewer.
          </li>
          <li>
            <strong>Mar 2026</strong> — Fengwu Sun, Xiaojing Lin, and Mingyu Li
            built the EMERALD+DIVER team website, including the public program
            pages, the team portal with target catalog and interactive spectrum
            viewer, auto-synced observing status from STScI, and the science
            projects page with Google Sheet integration.
          </li>
        </ul>
      </section>
    </div>
  );
}
