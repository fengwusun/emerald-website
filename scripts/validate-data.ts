import { loadCoiMembers, loadTargets } from "../lib/data";

function validateStorageKeys() {
  const targets = loadTargets();
  const invalid: string[] = [];

  for (const target of targets) {
    for (const asset of target.ancillary_assets) {
      if (!asset.storage_key.startsWith("targets/")) {
        invalid.push(`${target.emerald_id}: ${asset.storage_key}`);
      }
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Invalid storage_key prefixes:\n${invalid.join("\n")}`);
  }

  return targets.length;
}

function main() {
  const targetCount = validateStorageKeys();
  const coiCount = loadCoiMembers().length;
  console.log(`Validated ${targetCount} targets and ${coiCount} Co-I records.`);
}

main();
