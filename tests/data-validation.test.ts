import test from "node:test";
import assert from "node:assert/strict";
import { loadCoiMembers, loadTargets } from "../lib/data";

test("target catalog loads with required fields", () => {
  const targets = loadTargets();
  assert.ok(targets.length > 0);
  for (const target of targets) {
    assert.match(target.emerald_id, /^EMR-/);
    assert.ok(target.z_spec >= 0);
    for (const asset of target.ancillary_assets) {
      assert.match(asset.storage_key, /^targets\//);
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
