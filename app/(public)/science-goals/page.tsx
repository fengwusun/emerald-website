export default function ScienceGoalsPage() {
  return (
    <div className="grid">
      <h1>Science Goals</h1>

      <section className="card">
        <h2>Primary Objectives</h2>
        <div style={{ height: "1.5rem" }} />
        <h3>EMERALD (GO-7935)</h3>
        <p>
          Measure how frequently accreting black holes appear in normal
          star-forming galaxies during the first ~1.5 billion years of cosmic
          history (z~4-9), and build a robust, homogeneous census of AGN
          incidence in a statistically meaningful galaxy sample.
        </p>
        <h3>DIVER (GO-8018)</h3>
        <p>
          DIVER adds deep rest-frame UV spectroscopy at z~5-9 to directly
          address two core goals: (1) clock the star-formation history by
          determining the distribution and redshift evolution of carbon
          abundance, and (2) probe the prevalence of extremely high electron
          density and its connection to bursty star formation and chemical
          peculiarity. In parallel, DIVER strengthens high-impact science on UV
          AGN demographics, massive stellar populations, and reionization
          constraints from LyA, complementing EMERALD rest-optical diagnostics.
        </p>
      </section>

      <section className="card">
        <h2>Key Science Questions</h2>
        <div style={{ height: "1.5rem" }} />
        <h3>EMERALD</h3>
        <ul>
          <li>
            How does AGN incidence vary with galaxy properties, star-formation
            intensity, and evolutionary stage?
          </li>
          <li>
            How does the AGN population evolve across redshift within the
            reionization-era and post-reionization universe?
          </li>
          <li>
            What fraction of AGN activity is identifiable through broad-line
            versus narrow-line and high-ionization signatures?
          </li>
          <li>
            How do selection effects and host-galaxy demographics influence
            inferred AGN fractions in high-redshift samples?
          </li>
        </ul>
        <h3>DIVER</h3>
        <ul>
          <li>
            How do carbon abundance and electron-density distributions evolve
            with redshift, and what do they imply for bursty star formation and
            early chemical enrichment?
          </li>
          <li>
            How do UV diagnostics (for example CIV, HeII, CIII], OIII], LyA)
            constrain ionization conditions, massive stellar populations, and
            AGN signatures at z~5-9?
          </li>
          <li>
            How do DIVER UV constraints connect to EMERALD rest-optical
            diagnostics in the same systems?
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Key Measurements and Diagnostics</h2>
        <div style={{ height: "1.5rem" }} />
        <h3>EMERALD</h3>
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
        <h3>DIVER</h3>
        <ul>
          <li>
            Deep UV line measurements (including CIV, HeII, CIII], OIII]) for
            ionization, abundance, and density constraints.
          </li>
          <li>
            LyA constraints on reionization-era gas conditions and IGM
            transmission.
          </li>
          <li>
            Targeted UV spectroscopy of known AGNs, UV emitters from literature
            or the JADES NIRSpec database, bright high-z sources, and high-EW
            OIII/Halpha emitters from grism surveys.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Legacy Value</h2>
        <p>
          Beyond AGN demographics, EMERALD+DIVER delivers a large, uniform
          GOODS-N spectroscopic legacy set that supports galaxy assembly
          studies, ionized-gas physics, stellar-population constraints, and
          calibration of early-universe diagnostics across UV and rest-optical
          regimes.
        </p>
        <p>
          Program references: GO-7935{" "}
          <a
            href="https://www.stsci.edu/jwst/science-execution/program-information?id=7935"
            target="_blank"
            rel="noreferrer"
          >
            STScI Program Page
          </a>
          {" | "}
          <a
            href="https://www.stsci.edu/jwst-program-info/download/jwst/pdf/7935/"
            target="_blank"
            rel="noreferrer"
          >
            Public PDF
          </a>{" "}
          ; GO-8018{" "}
          <a
            href="https://www.stsci.edu/jwst/science-execution/program-information?id=8018"
            target="_blank"
            rel="noreferrer"
          >
            STScI Program Page
          </a>
          {" | "}
          <a
            href="https://www.stsci.edu/jwst-program-info/download/jwst/pdf/8018/"
            target="_blank"
            rel="noreferrer"
          >
            Public PDF
          </a>
        </p>
      </section>
    </div>
  );
}
