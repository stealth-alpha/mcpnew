import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scaffoldProject } from "../src/scaffold.js";
import { auditProject } from "../src/audit.js";

function scaffolded(name, lang = "js") {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mcpnew-audit-")), name);
  scaffoldProject(dir, { lang });
  return dir;
}

test("fresh scaffold passes audit", () => {
  const { ok, findings } = auditProject(scaffolded("clean"));
  assert.equal(ok, true, findings.map((f) => f.msg).join("; "));
});

test("audit fails when manifest default flips to allow", () => {
  const dir = scaffolded("flip");
  const p = path.join(dir, "mcp.permissions.json");
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  m.default = "allow";
  fs.writeFileSync(p, JSON.stringify(m));
  const { ok } = auditProject(dir);
  assert.equal(ok, false);
});

test("audit fails when a tool lacks its requireAllowed gate", () => {
  const dir = scaffolded("nogate");
  const serverPath = path.join(dir, "src/server.js");
  let src = fs.readFileSync(serverPath, "utf8");
  src = src.replace(/requireAllowed\("ping"\);/, "");
  src = src.replace(/auditToolCall\("ping"\)/, '"(unwired)"');
  fs.writeFileSync(serverPath, src);
  const { ok, findings } = auditProject(dir);
  assert.equal(ok, false);
  assert.ok(findings.some((f) => f.msg.includes("requireAllowed")), findings.map((f) => f.msg).join("; "));
  assert.ok(findings.some((f) => f.msg.includes("audit hook not wired")));
});

test("audit fails for unregistered manifest tools only as a warning", () => {
  const dir = scaffolded("stale");
  const p = path.join(dir, "mcp.permissions.json");
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  m.tools["ghost-tool"] = "deny";
  fs.writeFileSync(p, JSON.stringify(m));
  const { ok, findings } = auditProject(dir);
  assert.equal(ok, true); // deny entries for stale tools are not dangerous
  assert.ok(findings.some((f) => f.level === "warn" && f.msg.includes("ghost-tool")));
});

test("audit fails on missing or broken manifest", () => {
  const missing = scaffolded("gone");
  fs.rmSync(path.join(missing, "mcp.permissions.json"));
  assert.equal(auditProject(missing).ok, false);

  const broken = scaffolded("broken");
  fs.writeFileSync(path.join(broken, "mcp.permissions.json"), "{not json");
  assert.equal(auditProject(broken).ok, false);
});
