export default function ObservingPlanPage() {
  return (
    <div className="grid">
      <h1>Observing Plan</h1>
      <section className="card">
        <p>
          EMERALD uses JWST/NIRSpec multi-object spectroscopy to build a large,
          uniform sample of high-redshift galaxies in GOODS-N for AGN
          demographic measurements.
        </p>
        <p>
          The strategy is optimized for observational efficiency: many sources
          are observed per pointing, with field placement chosen to maximize
          target yield while preserving broad coverage in the deep-field
          footprint.
        </p>
      </section>
      <section className="card">
        <h2>Instrument Configuration</h2>
        <ul>
          <li>Instrument: NIRSpec</li>
          <li>Mode: G395M/F290LP</li>
          <li>Field: GOODS-N</li>
          <li>Sample size: ~900 galaxies</li>
          <li>Redshift focus: z~4-9</li>
        </ul>
      </section>
      <section className="card">
        <h2>Targeting Philosophy</h2>
        <ul>
          <li>
            Prioritize sources with robust prior redshift constraints from
            existing deep imaging/spectroscopic resources.
          </li>
          <li>
            Maintain broad coverage in galaxy properties to reduce demographic
            bias in AGN-fraction estimates.
          </li>
          <li>
            Coordinate with legacy GOODS-N datasets to enable rapid
            interpretation and follow-up science.
          </li>
        </ul>
      </section>
      <section className="card">
        <h2>Data Products</h2>
        <p>
          The collaboration portal is designed around per-target metadata,
          cutouts, source-preview images, and links to ancillary products so
          that analysis teams can move from sample-level views to object-level
          inspection quickly.
        </p>
      </section>
      <section className="card">
        <h2>Public Program References</h2>
        <p>
          Official public program information:
          <br />
          <a
            href="https://www.stsci.edu/jwst-program-info/download/jwst/pdf/7935/"
            target="_blank"
            rel="noreferrer"
          >
            JWST Program 7935 (STScI)
          </a>
        </p>
      </section>
      <section className="card">
        <p className="muted">
          This page intentionally provides high-level observing strategy only;
          implementation-level details are reserved for team workflows.
        </p>
      </section>
    </div>
  );
}
