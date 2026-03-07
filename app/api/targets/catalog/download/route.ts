import { NextResponse } from "next/server";
import { loadTargets } from "@/lib/data";
import { getEmissionLineTagsForTarget, getQuickTagsForTarget } from "@/lib/target-tags";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(digits);
}

export async function GET() {
  try {
    const targets = loadTargets();
    const headers = [
      "emerald_id",
      "name",
      "ra_deg",
      "dec_deg",
      "z_spec",
      "f200w_mag",
      "f444w_mag",
      "priority",
      "status",
      "jwst_program_id",
      "instruments",
      "observation_modes",
      "quick_tags",
      "emission_line_tags",
      "notes",
      "asset_count",
      "asset_labels",
      "asset_storage_keys"
    ];

    const lines = [headers.join(",")];
    for (const target of targets) {
      const quickTags = getQuickTagsForTarget(target).join("|");
      const emissionTags = getEmissionLineTagsForTarget(target).join("|");
      const observationModes =
        target.observation_modes.length > 0
          ? target.observation_modes.map((mode) => `${mode.instrument}:${mode.status}`).join("|")
          : target.instruments.map((instrument) => `${instrument}:${target.status}`).join("|");
      const assetLabels = target.ancillary_assets.map((asset) => asset.label).join("|");
      const assetKeys = target.ancillary_assets.map((asset) => asset.storage_key).join("|");

      const row = [
        target.emerald_id,
        target.name,
        formatNumber(target.ra, 7),
        formatNumber(target.dec, 7),
        formatNumber(target.z_spec, 3),
        target.f200w >= 99 ? "99" : formatNumber(target.f200w, 2),
        target.f444w >= 99 ? "99" : formatNumber(target.f444w, 2),
        target.priority,
        target.status,
        target.jwst_program_id,
        target.instruments.join("|"),
        observationModes,
        quickTags,
        emissionTags,
        target.notes,
        String(target.ancillary_assets.length),
        assetLabels,
        assetKeys
      ].map((value) => csvEscape(value ?? ""));

      lines.push(row.join(","));
    }

    const csv = `${lines.join("\n")}\n`;
    const stamp = new Date().toISOString().replace(/[:]/g, "-");
    const filename = `emerald_compiled_target_catalog_${stamp}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to compile catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
