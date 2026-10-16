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
        <h2>New: Y. Zhu SMILES Reductions</h2>
        <p className="muted">
          Spectra reduced by Yongda Zhu with the SMILES pipeline, bundled per source. Open any target and look under
          Data Products for the &ldquo;Y.Zhu v0.2a&rdquo; or &ldquo;Y.Zhu v0.2&rdquo; groups.
        </p>
        <table>
          <thead>
            <tr>
              <th>Data set</th>
              <th>Release</th>
              <th>Observations</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EMERALD G395M/F290LP</td>
              <td>v0.2a (May 2026)</td>
              <td>Obs 1&ndash;3</td>
              <td>455 (480 bundles)</td>
            </tr>
            <tr>
              <td>DIVER G140M/F070LP</td>
              <td>v0.2a (May 2026)</td>
              <td>Obs 1</td>
              <td>260</td>
            </tr>
            <tr>
              <td>DIVER PRISM/CLEAR</td>
              <td>v0.2 (Apr 2026)</td>
              <td>Obs 2&ndash;3</td>
              <td>1007 (1011 bundles)</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>
            <strong>Four background treatments per source:</strong> 3NOD (default 3-nod subtraction), 2NOD (useful
            for extended or crowded traces), SMBG (slit-based master background; cleaner removal of zodiacal and
            scattered light), and DIRTY (no subtraction; checks whether a feature comes from background removal).
          </li>
          <li>
            <strong>Files:</strong> quicklook PNG; bundle FITS with 2D spectra and 6- and 3-pixel 1D extractions
            for every branch; 1D CSV with wavelength in &Aring; and f<sub>&lambda;</sub> for all branches (errors only for
            3NOD 6-pixel; use the FITS for the others).
          </li>
          <li>
            <strong>EMERALD v0.2a</strong> covers about 2.73&ndash;5.32&nbsp;&micro;m, wider than v0.2
            (2.85&ndash;5.29&nbsp;&micro;m).
          </li>
          <li>
            <strong>448 PRISM sources from DIVER Obs 3</strong> are new in the catalog. Positions come from the
            bundle summary; redshifts are not assigned yet.
          </li>
          <li>
            <strong>Known issues:</strong> detector persistence can leave faint over-subtraction in SMBG, mostly
            for the grating. Only one source per slitlet is extracted; ask Yongda Zhu if you need another source.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>News</h2>
        <ul>
          <li>
            <strong>Oct 2026</strong> &mdash; Yongda Zhu&apos;s SMILES reductions (EMERALD v0.2a, DIVER G140M v0.2a,
            DIVER PRISM v0.2) are now on every target page, and 448 PRISM sources from DIVER Obs 3 joined the{" "}
            <Link href={withBasePath("/portal/targets")}>Target Catalog</Link>. Sijia Cai&apos;s EMERALD G395M 2D
            spectra can now be downloaded as well.
          </li>
          <li>
            <strong>Apr 2026</strong> — Sijia Cai processed the EMERALD
            Obs 01, 02, and 03 G395M/F290LP data products. The reduced spectra
            are now being incorporated into the{" "}
            <Link href={withBasePath("/portal/targets")}>Target Catalog</Link>
            {" "}and the{" "}
            <Link href={withBasePath("/portal/spectra")}>Quick Interactive</Link>
            {" "}viewer.
          </li>
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
