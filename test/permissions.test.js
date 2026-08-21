import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDenyAllManifest, validateManifest, MANIFEST_VERSION } from "../src/permissions.js";

test("deny-all manifest denies every listed tool", () => {
  const m = buildDenyAllManifest(["ping", "read-file"]);
  assert.equal(m.default, "deny");
  assert.equal(m.tools["ping"], "deny");
  assert.equal(m.tools["read-file"], "deny");
  assert.equal(m.network.default, "deny");
  assert.equal(m.filesystem.default, "deny");
  assert.equal(m.resources.default, "deny");
  assert.equal(m.prompts.default, "deny");
});

test("deny-all manifest has correct version and empty allowlists", () => {
  const m = buildDenyAllManifest([]);
  assert.equal(m.version, MANIFEST_VERSION);
  assert.deepEqual(m.network.allowlist, []);
  assert.deepEqual(m.filesystem.paths, []);
});

test("validator accepts a pristine deny-all manifest", () => {
  const { ok, violations } = validateManifest(buildDenyAllManifest(["a", "b"]));
  assert.equal(ok, true, violations.join("; "));
});

test("validator rejects allow-all default", () => {
  const m = buildDenyAllManifest(["ping"]);
  m.default = "allow";
  const { ok, violations } = validateManifest(m);
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.includes("default")));
});

test("validator rejects wildcard tool grants", () => {
  const m = buildDenyAllManifest([]);
  m.tools["*"] = "allow";
  const { ok } = validateManifest(m);
  assert.equal(ok, false);
});

test("validator rejects non-boolean tool verdicts", () => {
  const m = buildDenyAllManifest(["ping"]);
  m.tools["ping"] = "yes-please";
  const { ok, violations } = validateManifest(m);
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.includes("tools.ping")));
});

test("validator rejects permissive network/filesystem defaults", () => {
  const m = buildDenyAllManifest([]);
  m.network.default = "allow";
  m.filesystem.default = "allow";
  const { ok, violations } = validateManifest(m);
  assert.equal(ok, false);
  assert.equal(violations.length, 2);
});

test("validator rejects non-object manifests", () => {
  assert.equal(validateManifest(null).ok, false);
  assert.equal(validateManifest([1, 2]).ok, false);
  assert.equal(validateManifest("deny").ok, false);
});
