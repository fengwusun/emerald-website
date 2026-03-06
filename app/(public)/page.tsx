import Link from "next/link";

export default function ProgramPage() {
  return (
    <div className="grid">
      <section className="hero">
        <h1>EMERALD: AGN Emergence in the Early Universe</h1>
        <p>
          Efficient measurement of emergence rate of AGN in legacy deep field
          (EMERALD) is a JWST Cycle-4 program (GO-7935), led by PI Fengwu Sun
          and co-PI Xiaojing Lin.
        </p>
        <p>
          The program acquires NIRSpec G395M spectra for approximately 900
          galaxies across z=4-9 in GOODS-N.
        </p>
        <div className="grid grid-2" style={{ marginTop: "1rem" }}>
          <div className="card" style={{ background: "rgba(255, 255, 255, 0.62)", borderColor: "rgba(15, 143, 111, 0.25)" }}>
            <small>Program ID</small>
            <h3>GO-7935</h3>
          </div>
          <div className="card" style={{ background: "rgba(255, 255, 255, 0.62)", borderColor: "rgba(15, 143, 111, 0.25)" }}>
            <small>Instrument Mode</small>
            <h3>NIRSpec G395M</h3>
          </div>
        </div>
      </section>

      <section className="grid grid-2">
        <article className="card">
          <h2>Program Snapshot</h2>
          <p>
            EMERALD expands AGN demographics at cosmic dawn by combining JWST
            spectroscopy with rich ancillary imaging and spectral products.
          </p>
          <p>
            <Link
              href="https://www.stsci.edu/jwst-program-info/download/jwst/pdf/7935/"
              target="_blank"
              rel="noreferrer"
            >
              Official STScI Program PDF
            </Link>
          </p>
        </article>
        <article className="card">
          <h2>Data Access</h2>
          <p>
            Team members can access target metadata, ancillary products, and
            download links through the portal.
          </p>
          <p>
            <Link href="/portal/targets">Open Portal</Link>
          </p>
        </article>
      </section>
    </div>
  );
}
