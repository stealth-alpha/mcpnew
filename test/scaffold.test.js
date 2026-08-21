import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scaffoldProject, slugifyServerName } from "../src/scaffold.js";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcpnew-"));
}

test("slugify normalizes weird names", () => {
  assert.equal(slugifyServerName("My Cool Server!"), "my-cool-server");
  assert.equal(slugifyServerName("--weird--"), "weird");
  assert.equal(slugifyServerName(""), "");
});

test("scaffold creates the full JS file set", () => {
  const dir = path.join(tmp(), "demo-server");
  const { files } = scaffoldProject(dir, { lang: "js" });
  for (const expected of [
    "package.json",
    "README.md",
    ".gitignore",
    "mcp.permissions.json",
    "src/server.js",
    "src/audit.js",
    "src/manifest.js",
    "test/server.test.js",
  ]) {
    assert.ok(files.includes(expected), `missing ${expected}`);
    assert.ok(fs.existsSync(path.join(dir, expected)));
  }
});

test("scaffold creates TS extras when lang=ts", () => {
  const dir = path.join(tmp(), "demo-ts");
  const { files } = scaffoldProject(dir, { lang: "ts" });
  assert.ok(files.includes("src/server.ts"));
  assert.ok(files.includes("tsconfig.json"));
  const ts = fs.readFileSync(path.join(dir, "src/server.ts"), "utf8");
  assert.match(ts, /server\.tool\(\s*"ping"/);
  assert.match(ts, /requireAllowed\("ping"\)/);
  assert.match(ts, /auditToolCall\("ping"\)/);
});

test("generated manifest is deny-all with ping denied", () => {
  const dir = path.join(tmp(), "perm-check");
  scaffoldProject(dir, {});
  const m = JSON.parse(fs.readFileSync(path.join(dir, "mcp.permissions.json"), "utf8"));
  assert.equal(m.default, "deny");
  assert.equal(m.tools.ping, "deny");
});

test("generated server source is syntactically valid JS", () => {
  const dir = path.join(tmp(), "syntax-check");
  scaffoldProject(dir, { lang: "js" });
  execFileSync(process.execPath, ["--check", path.join(dir, "src/server.js")]);
  execFileSync(process.execPath, ["--check", path.join(dir, "src/audit.js")]);
  execFileSync(process.execPath, ["--check", path.join(dir, "src/manifest.js")]);
});

test("scaffold refuses non-empty dirs without --force", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "existing.txt"), "hi");
  assert.throws(() => scaffoldProject(dir, {}), (err) => err.code === "EEXIST");
  assert.doesNotThrow(() => scaffoldProject(dir, { force: true }));
});
