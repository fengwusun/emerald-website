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

export function getQuickTagsForTarget(target: Pick<TargetRecord, "notes">): string[] {
  const tags: string[] = [];

  for (const tag of splitNoteTags(target.notes)) {
    const tagLower = tag.toLowerCase();
    let replaced = false;

    if (isLiteratureUvEmitterTag(tagLower)) {
      tags.push("Literature UV emitter");
      replaced = true;
    }

    if (isJadesNirspecTag(tagLower)) {
      tags.push("JADES-NIRSpec sources");
      replaced = true;
    }

    if (isAgnTag(tagLower)) {
      tags.push("AGNs");
      replaced = true;
    }

    if (tagLower === "prism 2mask" || tagLower === "grism low o3") {
      replaced = true;
    }

    if (tagLower === "hb") {
      replaced = true;
    }

    if (!replaced) {
      tags.push(tag);
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
