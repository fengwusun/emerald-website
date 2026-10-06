import test from "node:test";
import assert from "node:assert/strict";
import { hasValidStorageKeyPrefix, loadCoiMembers, loadTargets } from "../lib/data";

test("target catalog loads with required fields", () => {
  const targets = loadTargets();
  assert.ok(targets.length > 0);
  for (const target of targets) {
    // EMR-<id> for EMERALD targets, DIV-<JADES id> for DIVER-only targets.
    assert.match(target.emerald_id, /^(EMR|DIV)-\d+$/);
    // Submitted redshifts may be negative (used to reject a wrong bot redshift); same range as the submission schema.
    assert.ok(
      Number.isFinite(target.z_spec) && target.z_spec > -1 && target.z_spec < 20,
      `${target.emerald_id}: z_spec ${target.z_spec}`
    );
    for (const asset of target.ancillary_assets) {
      assert.ok(hasValidStorageKeyPrefix(asset.storage_key), `${target.emerald_id}: ${asset.storage_key}`);
    }
  }
});

test("coi list loads with required fields", () => {
  const members = loadCoiMembers();
  assert.ok(members.length > 0);
  for (const member of members) {
    assert.ok(member.name.length > 0);
    assert.ok(member.role.length > 0);
  }
});
