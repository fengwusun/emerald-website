import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getMediaBaseDir } from "@/lib/media-path";

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseSourceMeta(filename: string): { observation: string; sourceId: string } {
  const match = filename.match(/^jw_o(\d+)_([0-9]+)_.*_x1d_joint_lsf_fit\.json$/i);
  if (!match) {
    return { observation: "", sourceId: "" };
  }
  return { observation: match[1], sourceId: match[2] };
}

export async function GET() {
  try {
    const prismDir = path.join(getMediaBaseDir(), "diver_prism_plots");
    if (!fs.existsSync(prismDir)) {
      return NextResponse.json({ error: `PRISM media directory not found: ${prismDir}` }, { status: 404 });
    }

    const files = fs
      .readdirSync(prismDir)
      .filter((name) => /_x1d_joint_lsf_fit\.json$/i.test(name))
      .sort((a, b) => a.localeCompare(b));

    const headers = [
      "record_type",
      "source_id",
      "observation",
      "z_input",
      "entry_id",
      "label",
      "obs_A",
      "flux",
      "flux_err",
      "snr",
      "detected_gt3sigma",
      "extra",
      "json_file"
    ];

    const rows: string[] = [headers.join(",")];

    for (const filename of files) {
      const fullPath = path.join(prismDir, filename);
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(fs.readFileSync(fullPath, "utf8")) as Record<string, unknown>;
      } catch {
        continue;
      }

      const meta = (payload.meta as Record<string, unknown> | undefined) ?? {};
      const { observation, sourceId } = parseSourceMeta(filename);
      const zInput = meta.z ?? "";

      const detectedGt3 = new Set(
        Array.isArray(payload.detected_gt3sigma)
          ? payload.detected_gt3sigma
              .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
              .map((entry) => String(entry.line_id ?? "").trim())
              .filter((lineId) => lineId.length > 0)
          : []
      );

      const lineResults = Array.isArray(payload.line_results) ? payload.line_results : [];
      for (const entry of lineResults) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const line = entry as Record<string, unknown>;
        const lineId = String(line.line_id ?? "").trim();
        const extra = `fit_mode=${meta.fit_mode ?? ""}`;

        rows.push(
          [
            "individual_line",
            sourceId,
            observation,
            zInput,
            lineId,
            line.line_name ?? "",
            line.obs_A ?? "",
            line.flux ?? "",
            line.flux_err ?? "",
            line.snr ?? "",
            detectedGt3.has(lineId) ? "1" : "0",
            extra,
            filename
          ]
            .map(csvEscape)
            .join(",")
        );
      }

      const jointGroups = Array.isArray(payload.joint_groups) ? payload.joint_groups : [];
      for (const entry of jointGroups) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const group = entry as Record<string, unknown>;
        const breakTerms = Array.isArray(group.break_terms) ? JSON.stringify(group.break_terms) : "";
        const extra = [
          `redchi2=${group.redchi2 ?? ""}`,
          `unresolved_oiii=${group.unresolved_oiii ?? ""}`,
          `unresolved_siii=${group.unresolved_siii ?? ""}`,
          `break_terms=${breakTerms}`
        ].join(";");

        rows.push(
          [
            "joint_group",
            sourceId,
            observation,
            zInput,
            group.label ?? "",
            group.label ?? "",
            "",
            "",
            "",
            "",
            "",
            "",
            extra,
            filename
          ]
            .map(csvEscape)
            .join(",")
        );
      }
    }

    const csv = `${rows.join("\n")}\n`;
    const stamp = new Date().toISOString().replace(/[:]/g, "-");
    const outName = `emerald_diver_prism_joint_lsf_fits_${stamp}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${outName}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compile line-fit table";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
