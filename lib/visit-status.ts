const VISIT_STATUS_REVALIDATE_SECONDS = 60 * 60 * 24;

export type VisitStatusRow = {
  observation: string;
  visit: string;
  status: string;
  hours: string;
  planWindow?: string;
  startTime?: string;
  endTime?: string;
};

export type ProgramVisitStatus = {
  programId: string;
  sourceUrl: string;
  reportTimestamp: string | null;
  fetchedAt: string;
  rows: VisitStatusRow[];
};

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const cleanCellText = (value: string) =>
  decodeEntities(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const extractCells = (rowHtml: string): string[] => {
  const results: string[] = [];
  const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match = cellRegex.exec(rowHtml);
  while (match) {
    results.push(cleanCellText(match[1]));
    match = cellRegex.exec(rowHtml);
  }
  return results;
};

const getCellByHeader = (
  headers: string[],
  cells: string[],
  possibleHeaders: string[],
  fallbackIndex: number
) => {
  if (headers.length === 0) {
    return cells[fallbackIndex] ?? "";
  }
  const headerIndex = headers.findIndex((header) =>
    possibleHeaders.some((candidate) => header.includes(candidate))
  );
  if (headerIndex >= 0 && headerIndex < cells.length) {
    return cells[headerIndex];
  }
  return "";
};

const rowSortNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

export const parseVisitStatusHtml = (
  programId: string,
  html: string
): ProgramVisitStatus => {
  const sourceUrl = `https://www.stsci.edu/jwst-program-info/visits/?program=${programId}`;
  const reportTimestampMatch = html.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
  const reportTimestamp = reportTimestampMatch
    ? cleanCellText(reportTimestampMatch[1])
    : null;

  const rows: VisitStatusRow[] = [];
  const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
  let tableMatch = tableRegex.exec(html);
  while (tableMatch) {
    const tableHtml = tableMatch[0];

    const headerRowMatch = tableHtml.match(
      /<thead[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>[\s\S]*?<\/thead>/i
    );
    const headers = extractCells(headerRowMatch?.[1] ?? "").map(normalizeHeader);

    const bodyMatch = tableHtml.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i);
    const rowBlock = bodyMatch?.[1] ?? tableHtml;
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch = rowRegex.exec(rowBlock);
    while (rowMatch) {
      const rowHtml = rowMatch[1];
      if (!/<td\b/i.test(rowHtml)) {
        rowMatch = rowRegex.exec(rowBlock);
        continue;
      }

      const cells = extractCells(rowHtml);
      if (cells.length === 0) {
        rowMatch = rowRegex.exec(rowBlock);
        continue;
      }

      const observation = getCellByHeader(headers, cells, ["observation"], 0);
      const visit = getCellByHeader(headers, cells, ["visit"], 1);
      const status = getCellByHeader(headers, cells, ["status"], 2);
      const hours = getCellByHeader(headers, cells, ["hours"], 5);
      const planWindow = getCellByHeader(headers, cells, ["plan windows"], 6);
      const startTime = getCellByHeader(headers, cells, ["start time"], 6);
      const endTime = getCellByHeader(headers, cells, ["end time"], 7);

      rows.push({
        observation,
        visit,
        status,
        hours,
        planWindow: planWindow || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined
      });

      rowMatch = rowRegex.exec(rowBlock);
    }

    tableMatch = tableRegex.exec(html);
  }

  rows.sort(
    (a, b) =>
      rowSortNumber(a.observation) - rowSortNumber(b.observation) ||
      rowSortNumber(a.visit) - rowSortNumber(b.visit)
  );

  return {
    programId,
    sourceUrl,
    reportTimestamp,
    fetchedAt: new Date().toISOString(),
    rows
  };
};

export const fetchProgramVisitStatus = async (
  programId: string
): Promise<ProgramVisitStatus | null> => {
  const sourceUrl = `https://www.stsci.edu/jwst-program-info/visits/?program=${programId}`;
  try {
    const response = await fetch(sourceUrl, {
      next: {
        revalidate: VISIT_STATUS_REVALIDATE_SECONDS
      }
    });
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    return parseVisitStatusHtml(programId, html);
  } catch {
    return null;
  }
};
