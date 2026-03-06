import test from "node:test";
import assert from "node:assert/strict";
import { parseVisitStatusHtml } from "../lib/visit-status";

test("parseVisitStatusHtml parses plan-window rows", () => {
  const html = `
    <html>
      <body>
        <h5>Fri Mar 06 07:23:43 EST 2026</h5>
        <table>
          <thead>
            <tr>
              <th>Observation</th>
              <th>Visit</th>
              <th>Status</th>
              <th>Target(s)</th>
              <th>Templates</th>
              <th>Hours</th>
              <th>Plan Windows</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>1</td>
              <td>Flight Ready</td>
              <td>target-a</td>
              <td>NIRSpec</td>
              <td>6.06</td>
              <td>Mar 24, 2026 - Apr 3, 2026</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const parsed = parseVisitStatusHtml("7935", html);
  assert.equal(parsed.programId, "7935");
  assert.equal(parsed.reportTimestamp, "Fri Mar 06 07:23:43 EST 2026");
  assert.equal(parsed.rows.length, 1);
  assert.deepEqual(parsed.rows[0], {
    observation: "1",
    visit: "1",
    status: "Flight Ready",
    hours: "6.06",
    planWindow: "Mar 24, 2026 - Apr 3, 2026",
    startTime: undefined,
    endTime: undefined
  });
});

test("parseVisitStatusHtml parses start/end and plan-window tables together", () => {
  const html = `
    <html>
      <body>
        <h5>Fri Mar 06 07:27:35 EST 2026</h5>
        <table id="visits1">
          <thead>
            <tr>
              <th>Observation</th>
              <th>Visit</th>
              <th>Status</th>
              <th>Target(s)</th>
              <th>Templates</th>
              <th>Hours</th>
              <th>Start Time (UT)</th>
              <th>End Time (UT)</th>
            </tr>
          </thead>
          <tr>
            <td>2</td>
            <td>2</td>
            <td>Archived</td>
            <td>target-b</td>
            <td>NIRSpec</td>
            <td>4.42</td>
            <td>Dec 26, 2025 06:39:20</td>
            <td>Dec 26, 2025 10:25:53</td>
          </tr>
        </table>
        <table id="visits2">
          <thead>
            <tr>
              <th>Observation</th>
              <th>Visit</th>
              <th>Status</th>
              <th>Target(s)</th>
              <th>Templates</th>
              <th>Hours</th>
              <th>Plan Windows</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>3</td>
              <td>1</td>
              <td>Implementation</td>
              <td>target-c</td>
              <td>NIRSpec</td>
              <td>3.79</td>
              <td>Apr 6, 2026 - Apr 16, 2026</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const parsed = parseVisitStatusHtml("8018", html);
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[0], {
    observation: "2",
    visit: "2",
    status: "Archived",
    hours: "4.42",
    planWindow: undefined,
    startTime: "Dec 26, 2025 06:39:20",
    endTime: "Dec 26, 2025 10:25:53"
  });
  assert.deepEqual(parsed.rows[1], {
    observation: "3",
    visit: "1",
    status: "Implementation",
    hours: "3.79",
    planWindow: "Apr 6, 2026 - Apr 16, 2026",
    startTime: undefined,
    endTime: undefined
  });
});
