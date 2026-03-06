import Image from "next/image";
import {
  fetchProgramVisitStatus,
  type VisitStatusRow
} from "@/lib/visit-status";

const FALLBACK_EMERALD_ROWS: VisitStatusRow[] = [
  {
    observation: "1",
    visit: "1",
    status: "Flight Ready",
    hours: "6.06",
    planWindow: "Mar 24, 2026 - Apr 3, 2026"
  },
  {
    observation: "2",
    visit: "1",
    status: "Flight Ready",
    hours: "6.67",
    planWindow: "Mar 24, 2026 - Apr 3, 2026"
  },
  {
    observation: "3",
    visit: "1",
    status: "Flight Ready",
    hours: "6.04",
    planWindow: "Mar 24, 2026 - Apr 3, 2026"
  },
  {
    observation: "4",
    visit: "1",
    status: "Flight Ready",
    hours: "6.06",
    planWindow: "Mar 24, 2026 - Apr 3, 2026"
  },
  {
    observation: "5",
    visit: "1",
    status: "Flight Ready",
    hours: "6.17",
    planWindow: "Mar 24, 2026 - Apr 3, 2026"
  },
  {
    observation: "6",
    visit: "1",
    status: "Flight Ready",
    hours: "6.34",
    planWindow: "Mar 24, 2026 - Apr 3, 2026"
  }
];

const FALLBACK_DIVER_ROWS: VisitStatusRow[] = [
  {
    observation: "1",
    visit: "1",
    status: "Archived",
    hours: "25.93",
    startTime: "Feb 24, 2026 00:20:03",
    endTime: "Feb 24, 2026 22:57:50"
  },
  {
    observation: "1",
    visit: "2",
    status: "Archived",
    hours: "25.34",
    startTime: "Feb 24, 2026 23:22:34",
    endTime: "Feb 25, 2026 21:20:04"
  },
  {
    observation: "2",
    visit: "1",
    status: "Archived",
    hours: "3.83",
    startTime: "Dec 26, 2025 10:25:58",
    endTime: "Dec 26, 2025 13:42:47"
  },
  {
    observation: "2",
    visit: "2",
    status: "Archived",
    hours: "4.42",
    startTime: "Dec 26, 2025 06:39:20",
    endTime: "Dec 26, 2025 10:25:53"
  },
  {
    observation: "3",
    visit: "1",
    status: "Implementation",
    hours: "3.79",
    planWindow: "Apr 6, 2026 - Apr 16, 2026"
  },
  {
    observation: "3",
    visit: "2",
    status: "Implementation",
    hours: "4.42",
    planWindow: "Apr 6, 2026 - Apr 16, 2026"
  },
  {
    observation: "3",
    visit: "3",
    status: "Implementation",
    hours: "3.82",
    planWindow: "Apr 6, 2026 - Apr 16, 2026"
  }
];

const formatTimingOrWindow = (row: VisitStatusRow) => {
  if (row.startTime && row.endTime) {
    return `${row.startTime} - ${row.endTime}`;
  }
  if (row.startTime) {
    return row.startTime;
  }
  if (row.endTime) {
    return row.endTime;
  }
  return row.planWindow ?? "TBD";
};

export default async function ObservingPlanPage() {
  const [emeraldStatus, diverStatus] = await Promise.all([
    fetchProgramVisitStatus("7935"),
    fetchProgramVisitStatus("8018")
  ]);

  const emeraldRows =
    emeraldStatus && emeraldStatus.rows.length > 0
      ? emeraldStatus.rows
      : FALLBACK_EMERALD_ROWS;
  const diverRows =
    diverStatus && diverStatus.rows.length > 0
      ? diverStatus.rows
      : FALLBACK_DIVER_ROWS;
  const usingFallback = !emeraldStatus || !diverStatus;
  const reportNotes = [
    emeraldStatus?.reportTimestamp
      ? `GO-7935 report: ${emeraldStatus.reportTimestamp}`
      : null,
    diverStatus?.reportTimestamp
      ? `GO-8018 report: ${diverStatus.reportTimestamp}`
      : null
  ].filter(Boolean) as string[];

  return (
    <div className="grid">
      <h1>Observing Plan</h1>

      <section className="card">
        <p>
          EMERALD+DIVER keeps the original EMERALD observing strategy and adds
          the DIVER UV-focused plan. Both programs are coordinated around GOODS-N
          high-redshift targets.
        </p>
      </section>

      <section className="card">
        <h2>EMERALD (GO-7935) Specific Configuration</h2>
        <ul>
          <li>Instrument: NIRSpec MOS</li>
          <li>Spectral mode: G395M/F290LP (2.8-5.1 um)</li>
          <li>Field: GOODS-N</li>
          <li>Target sample: 842 galaxies at z~4-9</li>
          <li>MSA configurations: 6</li>
          <li>Readout: NRSIRS2</li>
          <li>Nodding: 3-shutter dithering</li>
          <li>Per-pointing integration setup: 5 exposures x 16 groups</li>
          <li>On-source time per mask: about 4.9 hours</li>
          <li>Total on-source time (6 masks): about 29.4 hours</li>
        </ul>
      </section>

      <section className="card">
        <h2>DIVER (GO-8018) Specific Configuration</h2>
        <ul>
          <li>Instrument: NIRSpec MOS</li>
          <li>Field: GOODS-N</li>
          <li>Target sample: more than 140 galaxies at z~5-9</li>
          <li>Readout: NRSIRS2</li>
          <li>Nodding: 3-shutter nodding</li>
        </ul>

        <h3>Mode A: G140M/F070LP</h3>
        <ul>
          <li>Configurations: 2 masks</li>
          <li>Setup: 21 groups x 2 integrations per exposure x 8 exposures per mask</li>
          <li>On-source time per mask: about 20.6 hours</li>
          <li>Total on-source time: 41.2 hours</li>
        </ul>

        <h3>Mode B: PRISM/CLEAR</h3>
        <ul>
          <li>Configurations: 5 masks</li>
          <li>Setup: 19 groups x 2 integrations</li>
          <li>On-source time per mask: 8403.2 s (about 2.33 hours)</li>
          <li>Total on-source time: 11.7 hours</li>
        </ul>

        <h3>DIVER Pointing Footprints</h3>
        <p className="muted" style={{ marginTop: "0.25rem" }}>
          Footprint visualization of DIVER pointings in GOODS-N.
        </p>
        <Image
          src="/figures/diver_FOV.png"
          alt="DIVER pointing footprints in GOODS-N"
          width={1280}
          height={507}
          unoptimized
          style={{
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            borderRadius: "10px",
            border: "1px solid #cbe6de"
          }}
        />
      </section>

      <section className="card">
        <h2>Targeting Philosophy</h2>
        <div style={{ height: "1rem" }} />
        Joint strategy: Prioritize targets with bright rest-frame optical emission, or with indications of UV emission lines.
        <div style={{ height: "1rem" }} />    
        <h3>EMERALD</h3>
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

        <h3>DIVER</h3>
        <ul>
          <li>
            Prioritize known AGNs, UV emitters from literature and the JADES NIRSpec
            database, bright high-z sources, and high-EW O3 or Halpha emitters
            from grism surveys.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Current Observation and Visit Status</h2>
        <p className="muted">
          Auto-synced from STScI visit status reports every 24 hours.
          {reportNotes.length > 0 ? ` ${reportNotes.join(" | ")}` : ""}
        </p>
        {usingFallback ? (
          <p className="muted">
            One or more live status feeds are temporarily unavailable. Showing
            the latest local snapshot for missing program data.
          </p>
        ) : null}

        <h3>GO-7935 (EMERALD)</h3>
        <table>
          <thead>
            <tr>
              <th>Observation</th>
              <th>Visit</th>
              <th>Status</th>
              <th>Hours</th>
              <th>Plan Window</th>
            </tr>
          </thead>
          <tbody>
            {emeraldRows.map((row) => (
              <tr key={`emr-${row.observation}-${row.visit}`}>
                <td>{row.observation}</td>
                <td>{row.visit}</td>
                <td>{row.status}</td>
                <td>{row.hours}</td>
                <td>{row.planWindow ?? formatTimingOrWindow(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: "1rem" }}>GO-8018 (DIVER)</h3>
        <table>
          <thead>
            <tr>
              <th>Observation</th>
              <th>Visit</th>
              <th>Status</th>
              <th>Hours</th>
              <th>Timing / Plan Window</th>
            </tr>
          </thead>
          <tbody>
            {diverRows.map((row) => (
              <tr key={`div-${row.observation}-${row.visit}-${row.status}`}>
                <td>{row.observation}</td>
                <td>{row.visit}</td>
                <td>{row.status}</td>
                <td>{row.hours}</td>
                <td>{formatTimingOrWindow(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Public Program References</h2>
        <p>
          GO-7935:
          <br />
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
          </a>
        </p>
        <p>
          GO-8018:
          <br />
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
