export default function ScienceGoalsPage() {
  return (
    <div className="grid">
      <h1>Science Goals</h1>
      <section className="card">
        <h2>Primary Objective</h2>
        <p>
          EMERALD is designed to measure how frequently accreting black holes
          appear in normal star-forming galaxies during the first ~1.5 billion
          years of cosmic history (z~4-9). The core goal is a robust,
          homogeneous census of AGN incidence in a statistically meaningful
          galaxy sample.
        </p>
      </section>
      <section className="card">
        <h2>Key Science Questions</h2>
        <ul>
          <li>
            How does AGN incidence vary with galaxy properties such as star
            formation intensity and stellar growth stage?
          </li>
          <li>
            How does the AGN population evolve across redshift within the
            reionization-era and post-reionization universe?
          </li>
          <li>
            What fraction of AGN activity is identifiable through broad-line
            versus narrow-line and high-ionization signatures?
          </li>
        </ul>
      </section>
      <section className="card">
        <h2>Key Measurements and Diagnostics</h2>
        <ul>
          <li>
            Rest-optical emission-line diagnostics to separate AGN-driven and
            star-formation-driven ionization.
          </li>
          <li>
            Broad-line AGN identification from deep spectroscopy in wavelength
            regions where previous wide-field slitless data are less complete.
          </li>
          <li>
            Joint interpretation with ancillary imaging and SED information to
            connect nuclear activity with host-galaxy context.
          </li>
        </ul>
      </section>
      <section className="card">
        <h2>Legacy Value</h2>
        <p>
          Beyond AGN demographics, the program delivers a large, uniform
          spectroscopic set for high-redshift galaxies in GOODS-N that supports
          broader studies of galaxy assembly, ionized gas conditions, and
          calibration of early-universe diagnostics.
        </p>
        <p className="muted">
          Public-facing summaries intentionally remain high-level; full
          strategy details are reserved for collaboration analysis products.
        </p>
      </section>
      <section className="card">
        <h2>Public Program Reference</h2>
        <p>
          For official public program metadata, see the STScI program record:
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
    </div>
  );
}
