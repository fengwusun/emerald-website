import { parse } from "csv-parse/sync";

const SHEET_ID = "1mW5dj9LEOfNadKGAZFh_IJLjwfApueGboT_1S9Z8OCU";
const SHEET_GID = "0";
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

export type SheetScienceProject = {
  id: string;
  title: string;
  dataset: string;
  leadName: string;
  description: string;
  expectedTimeline: string;
  interested: string;
};

/**
 * Fetch the published Google Sheet as CSV and parse rows into typed
 * science-project objects.  Empty rows and the example row (ID "0") are
 * filtered out.
 */
export async function fetchScienceProjectsFromSheet(): Promise<
  SheetScienceProject[]
> {
  const response = await fetch(EXPORT_URL, { next: { revalidate: 86400 } });
  if (!response.ok) {
    console.error(
      `[google-sheets] Failed to fetch sheet: ${response.status} ${response.statusText}`
    );
    return [];
  }

  const csvText = await response.text();
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const projects: SheetScienceProject[] = [];

  for (const row of rows) {
    const id = (row["ID"] ?? "").trim();
    const title = (row["Project Title"] ?? "").trim();
    const leadName = (row["Project Leader"] ?? "").trim();

    // Skip rows with no ID/title, the example row (ID "0"), and instruction rows
    if (!id || !title || id === "0") continue;

    projects.push({
      id,
      title,
      dataset: (row["Dataset"] ?? "").trim(),
      leadName,
      description: (
        row["A few sentences on the project scope"] ?? ""
      ).trim(),
      expectedTimeline: (row["Expected Timeline"] ?? "").trim(),
      interested: (row["Who's interested?"] ?? "").trim(),
    });
  }

  return projects;
}
