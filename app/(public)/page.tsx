import Link from "next/link";
import { withBasePath } from "@/lib/base-path";

export default function ProgramPage() {
  return (
    <div className="grid">
      <section className="hero">
        <h1>EMERALD+DIVER: AGN and UV Spectroscopy in the Early Universe</h1>
        <p>
          EMERALD+DIVER combines two JWST Cycle-4 GO programs: GO-7935
          (EMERALD) and GO-8018 (DIVER).
        </p>
        <p>
          The merged program keeps the original EMERALD science scope and adds
          DIVER deep UV spectroscopy for a joint analysis framework.
        </p>
        <div className="grid grid-2" style={{ marginTop: "1rem" }}>
          <div
            className="card"
            style={{
              background: "rgba(255, 255, 255, 0.62)",
              borderColor: "rgba(15, 143, 111, 0.25)"
            }}
          >
            <small>Program IDs</small>
            <h3>GO-7935 + GO-8018</h3>
          </div>
          <div
            className="card"
            style={{
              background: "rgba(255, 255, 255, 0.62)",
              borderColor: "rgba(15, 143, 111, 0.25)"
            }}
          >
            <small>Total External Allocation</small>
            <h3>110.2 Hours</h3>
          </div>
        </div>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h2>GO-7935 (EMERALD)</h2>
          <p>
            Efficient Measurement of the Emergence Rate of AGN in Legacy Deep
            Field
          </p>
          <ul>
            <li>PI: Fengwu Sun (Harvard University)</li>
            <li>Instrument/Mode: NIRSpec MOS, G395M/F290LP</li>
            <li>Sample: 842 galaxies at z = 4-9 in GOODS-N</li>
            <li>External Allocation: 37.1 hours</li>
          </ul>
          <p>
            <Link
              href="https://www.stsci.edu/jwst/science-execution/program-information?id=7935"
              target="_blank"
              rel="noreferrer"
            >
              STScI Program Page (7935)
            </Link>
            <br />
            <Link
              href="https://www.stsci.edu/jwst-program-info/download/jwst/pdf/7935/"
              target="_blank"
              rel="noreferrer"
            >
              Public PDF (7935)
            </Link>
          </p>
        </article>

        <article className="card">
          <h2>GO-8018 (DIVER)</h2>
          <p>DIVER: Deep Insights into UV Spectroscopy at the Epoch of Reionization</p>
          <ul>
            <li>PI: Xiaojing Lin (Tsinghua University)</li>
            <li>Instrument/Modes: NIRSpec MOS, G140M/F070LP and PRISM/CLEAR</li>
            <li>Sample: over 140 galaxies at z = 5-9 in GOODS-N</li>
            <li>External Allocation: 73.1 hours</li>
          </ul>
          <p>
            <Link
              href="https://www.stsci.edu/jwst/science-execution/program-information?id=8018"
              target="_blank"
              rel="noreferrer"
            >
              STScI Program Page (8018)
            </Link>
            <br />
            <Link
              href="https://www.stsci.edu/jwst-program-info/download/jwst/pdf/8018/"
              target="_blank"
              rel="noreferrer"
            >
              Public PDF (8018)
            </Link>
          </p>
        </article>
      </section>

      <section className="card">
        <h2>Instrument Modes and Time Allocation</h2>
        <ul>
          <li>
            GO-7935: NIRSpec MOS G395M/F290LP, 6 masks, about 4.9 h on-source
            per mask (about 29.4 h on-source total).
          </li>
          <li>
            GO-8018 mode A: NIRSpec MOS G140M/F070LP, 2 masks, about 20.6 h
            on-source per mask (41.2 h total).
          </li>
          <li>
            GO-8018 mode B: NIRSpec MOS PRISM/CLEAR, 5 masks, about 8403.2 s
            (about 2.33 h) on-source per mask (11.7 h total).
          </li>
        </ul>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h2>Program Snapshot</h2>
          <p>
            EMERALD+DIVER combines rest-optical and UV diagnostics to improve
            constraints on AGN demographics, ionization conditions, and chemical
            enrichment in the epoch of reionization.
          </p>
        </article>
        <article className="card">
          <h2>Data Access</h2>
          <p>
            Team members can access target metadata, ancillary products, and
            download links through the portal.
          </p>
          <p>
            <Link href={withBasePath("/portal/targets")}>Open Portal</Link>
          </p>
        </article>
      </section>
    </div>
  );
}
