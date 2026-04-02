import { loadTargets } from "@/lib/data";
import { getEmissionLineTagsForTarget, getQuickTagsForTarget } from "@/lib/target-tags";
import { SpectraBrowser } from "./spectra-browser";

export const dynamic = "force-dynamic";

export type SpectraSourceEntry = {
  emeraldId: string;
  name: string;
  ra: number;
  dec: number;
  zSpec: number;
  emissionLineTags: string[];
  quickTags: string[];
  assets: Array<{ storageKey: string; label: string; profile?: string }>;
};

export default function SpectraPage() {
  const allTargets = loadTargets();

  // Keep only observed sources that have at least one 1D spectrum asset.
  const observedSources: SpectraSourceEntry[] = allTargets
    .filter((t) => {
      const topLevelObserved = t.status.toLowerCase() === "observed";
      const modeObserved = t.observation_modes.some(
        (m) => m.status.toLowerCase() === "observed"
      );
      return topLevelObserved || modeObserved;
    })
    .map((t) => ({
      emeraldId: t.emerald_id,
      name: t.name,
      ra: t.ra,
      dec: t.dec,
      zSpec: t.z_spec,
      emissionLineTags: getEmissionLineTagsForTarget(t),
      quickTags: getQuickTagsForTarget(t),
      assets: t.ancillary_assets
        .filter(
          (a) => /_x1d\.json$/i.test(a.storage_key)
        )
        .map((a) => ({
          storageKey: a.storage_key,
          label: a.label,
          profile: a.spectrum_profile
        }))
    }))
    .filter((s) => s.assets.length > 0);

  // Collect all unique tags that appear across the source list.
  const tagSet = new Set<string>();
  for (const s of observedSources) {
    for (const t of s.emissionLineTags) tagSet.add(t);
    for (const t of s.quickTags) tagSet.add(t);
  }
  const allTags = [...tagSet].sort();

  // Default source: prefer JADES-1010260
  const defaultId =
    observedSources.find((s) => s.name === "JADES-1010260")?.emeraldId ??
    observedSources.find((s) => s.name.includes("1010260"))?.emeraldId ??
    observedSources[0]?.emeraldId ??
    "";

  return (
    <SpectraBrowser
      sources={observedSources}
      defaultEmeraldId={defaultId}
      allTags={allTags}
    />
  );
}
