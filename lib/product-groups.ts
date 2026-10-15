import type { TargetRecord } from "@/lib/schemas";

type Asset = TargetRecord["ancillary_assets"][number];

export type ProductButton = { label: string; href: string; storageKey: string };

export type ProductRow = {
  key: string;
  tag: string;
  buttons: ProductButton[];
  preview?: { src: string; storageKey: string };
};

export type ProductGroup = {
  key: string;
  title: string;
  note?: string;
  rows: ProductRow[];
  thumbnails: Array<{ src: string; label: string; storageKey: string }>;
};

type Classified = {
  groupKey: string;
  title: string;
  note?: string;
  order: number;
  rowTag: string;
  button?: string;
  preview?: boolean;
  thumbnail?: string;
};

const BUNDLE_NOTE =
  "Bundle FITS holds the 3NOD, 2NOD, SMBG (slit master background), and DIRTY (no background subtraction) reductions, each with 6- and 3-pixel 1D extractions.";

const BUTTON_ORDER = ["Plot PDF", "1D FITS", "2D FITS", "Bundle FITS", "1D CSV", "Line fits JSON", "CIRC", "KRON"];

function classify(asset: Asset): Classified {
  const key = asset.storage_key;
  const lower = key.toLowerCase();
  const filename = key.split("/").pop() ?? key;

  if (asset.asset_type === "image" && lower.startsWith("targets/")) {
    const obs = filename.match(/-obs(\d+)_/i);
    return {
      groupKey: "finding-charts",
      title: "MSA finding charts",
      order: 90,
      rowTag: "",
      thumbnail: obs ? `obs ${obs[1]}` : filename
    };
  }

  // SMILES bundle folders carry the release in their name (EMERALDv0.2a/, DIVERv0.2/PRISM/).
  const setDir = key.slice(0, Math.max(0, key.length - filename.length - 1));
  const release = setDir.match(/v\d+\.\d+[a-z]*/i)?.[0];
  const bundle = filename.match(/^jw_o(\d+)_\d+_\d+_[A-Za-z0-9]+_([A-Za-z0-9]+)_([A-Za-z0-9]+)_bundle(_1d)?\.(png|fits|csv)$/i);
  if (bundle && release) {
    const grating = bundle[2].toUpperCase();
    const program = grating === "G395M" ? "EMERALD" : "DIVER";
    const extension = bundle[5].toLowerCase();
    return {
      groupKey: `bundle:${setDir}:${grating}`,
      title: `${program} ${grating} · SMILES ${release} bundle`,
      note: BUNDLE_NOTE,
      order: grating === "G395M" ? 20 : grating === "G140M" ? 30 : 50,
      rowTag: `o${bundle[1]} · ${bundle[3].toUpperCase()}`,
      button: extension === "fits" ? "Bundle FITS" : extension === "csv" ? "1D CSV" : undefined,
      preview: extension === "png"
    };
  }

  if (lower.startsWith("emerald_grating_plots/")) {
    const obs = filename.match(/^jw07935(\d{3})\d{3}_/i);
    return {
      groupKey: "emerald-pipeline",
      title: "EMERALD G395M · pipeline reduction",
      order: 10,
      rowTag: obs ? `o${obs[1]}` : "",
      button: lower.endsWith(".pdf")
        ? "Plot PDF"
        : lower.endsWith("_x1d.fits")
          ? "1D FITS"
          : lower.endsWith("_s2d.fits")
            ? "2D FITS"
            : undefined,
      preview: /\.(png|jpg|jpeg)$/i.test(lower)
    };
  }

  if (lower.startsWith("diver_grating_plots/")) {
    const obs = filename.match(/^jw_o(\d+)_/i);
    return {
      groupKey: "diver-grating-early",
      title: "DIVER G140M · early reduction",
      order: 40,
      rowTag: obs ? `o${obs[1]}` : "",
      button: lower.endsWith(".csv") ? "1D CSV" : undefined,
      preview: /\.(png|jpg|jpeg)$/i.test(lower)
    };
  }

  if (lower.startsWith("diver_prism_plots/")) {
    const obs = filename.match(/^jw_o(\d+)_/i);
    return {
      groupKey: "diver-prism-early",
      title: "DIVER PRISM · early reduction",
      order: 60,
      rowTag: obs ? `o${obs[1]}` : "",
      button: lower.endsWith("_x1d.fits")
        ? "1D FITS"
        : lower.endsWith("_s2d.fits")
          ? "2D FITS"
          : lower.endsWith(".json")
            ? "Line fits JSON"
            : undefined,
      preview: /\.(png|jpg|jpeg)$/i.test(lower)
    };
  }

  if (lower.startsWith("jades_photometry/")) {
    return {
      groupKey: "jades-photometry",
      title: "JADES DR5 photometry",
      order: 80,
      rowTag: "",
      button: /_kron\.csv$/i.test(lower) ? "KRON" : "CIRC"
    };
  }

  return { groupKey: "other", title: "Other files", order: 100, rowTag: "", button: asset.label };
}

// Groups a target's assets into compact product rows: one row per observation (and detector),
// short download buttons, an optional preview image, and thumbnails for finding charts.
export function groupTargetProducts(assets: Asset[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup & { order: number }>();

  for (const asset of assets) {
    // Assets without a preview URL (the 1D JSON caches) feed the interactive viewer only.
    if (!asset.preview_url) continue;
    const info = classify(asset);

    let group = groups.get(info.groupKey);
    if (!group) {
      group = { key: info.groupKey, title: info.title, note: info.note, order: info.order, rows: [], thumbnails: [] };
      groups.set(info.groupKey, group);
    }

    if (info.thumbnail) {
      group.thumbnails.push({ src: asset.preview_url, label: info.thumbnail, storageKey: asset.storage_key });
      continue;
    }

    let row = group.rows.find((candidate) => candidate.tag === info.rowTag);
    if (!row) {
      row = { key: `${info.groupKey}:${info.rowTag}`, tag: info.rowTag, buttons: [] };
      group.rows.push(row);
    }

    if (info.preview) {
      row.preview ??= { src: asset.preview_url, storageKey: asset.storage_key };
    } else if (info.button && !row.buttons.some((button) => button.href === asset.preview_url)) {
      row.buttons.push({ label: info.button, href: asset.preview_url, storageKey: asset.storage_key });
    }
  }

  // A plot without an observation tag (e.g. DIVER spectrum_plot_<id>.png) joins the group's only row.
  for (const group of groups.values()) {
    const untagged = group.rows.find((row) => row.tag === "" && row.buttons.length === 0 && row.preview);
    const others = group.rows.filter((row) => row !== untagged);
    if (untagged && others.length === 1 && !others[0].preview) {
      others[0].preview = untagged.preview;
      group.rows = others;
    }
  }

  const rank = (label: string) => {
    const index = BUTTON_ORDER.indexOf(label);
    return index < 0 ? BUTTON_ORDER.length : index;
  };

  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((group) => ({
      key: group.key,
      title: group.title,
      note: group.note,
      thumbnails: group.thumbnails,
      rows: group.rows
        .sort((a, b) => a.tag.localeCompare(b.tag))
        .map((row) => ({ ...row, buttons: row.buttons.sort((a, b) => rank(a.label) - rank(b.label)) }))
    }));
}
