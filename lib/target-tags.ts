import type { TargetRecord } from "@/lib/schemas";

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function splitNoteTags(notes: string): string[] {
  return notes
    .split(/[;/|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => item !== "-1")
    .map((item) => item.replace(/\s+/g, " "));
}

function isLiteratureUvEmitterTag(tagLower: string): boolean {
  return (
    tagLower.includes("m.t.") ||
    tagLower.includes("tang civ") ||
    tagLower.includes("d.s. nemitter") ||
    tagLower.includes("d.s. nemitters") ||
    tagLower.includes("d.s. nmeitter") ||
    tagLower.includes("d.s. nmeitters")
  );
}

function isJadesNirspecTag(tagLower: string): boolean {
  return tagLower.includes("nirspec ");
}

function isAgnTag(tagLower: string): boolean {
  return tagLower.includes("agn") || tagLower.includes("lrd");
}

function isDsfgTag(tagLower: string): boolean {
  return (
    tagLower.includes("n2cls") ||
    tagLower.includes("hdf850.1") ||
    tagLower.includes("xiao+") ||
    tagLower.includes("nircam-dark") ||
    tagLower.includes("gn10")
  );
}

export function getQuickTagsForTarget(target: Pick<TargetRecord, "notes">): string[] {
  const tags: string[] = [];

  for (const tag of splitNoteTags(target.notes)) {
    const tagLower = tag.toLowerCase();

    if (isLiteratureUvEmitterTag(tagLower)) {
      tags.push("UV Literature");
    }

    if (isJadesNirspecTag(tagLower)) {
      tags.push("JADES-NIRSpec");
    }

    if (isAgnTag(tagLower)) {
      tags.push("AGN/LRD");
    }

    if (isDsfgTag(tagLower)) {
      tags.push("DSFG");
    }

    if (tagLower.includes("high ew oiii + hb")) {
      tags.push("High-EW OIII+Hb");
    }

    if (tagLower.includes("prism 2mask")) {
      tags.push("Prism-2mask");
    }

    if (tagLower.includes("filler")) {
      tags.push("Filler");
    }

    if (tagLower.includes("low o3/hb")) {
      tags.push("Low O3/Hb");
    }
  }

  return dedupeTags(tags);
}

export function getEmissionLineTagsForTarget(
  target: Pick<TargetRecord, "notes" | "emission_line_tags">
): string[] {
  const tags = [...target.emission_line_tags];

  for (const tag of splitNoteTags(target.notes)) {
    if (tag.toLowerCase() === "hb") {
      tags.push("Hb");
    }
  }

  return dedupeTags(tags);
}
