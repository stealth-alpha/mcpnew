import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scaffoldProject, addToolStub } from "../src/scaffold.js";

function scaffolded(name) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mcpnew-add-")), name);
  scaffoldProject(dir, { lang: "js" });
  return dir;
}

test("add-tool inserts stub into server and denies it in the manifest", () => {
  const dir = scaffolded("proj");
  const { tool } = addToolStub(dir, "read-file");
  assert.equal(tool, "read-file");
  const m = JSON.parse(fs.readFileSync(path.join(dir, "mcp.permissions.json"), "utf8"));
  assert.equal(m.tools["read-file"], "deny");
  const server = fs.readFileSync(path.join(dir, "src/server.js"), "utf8");
  assert.match(server, /server\.tool\(\s*"read-file"/);
  assert.match(server, /requireAllowed\("read-file"\)/);
  assert.match(server, /auditToolCall\("read-file"\)/);
});

test("add-tool works on TS scaffolds too", () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mcpnew-ts-")), "tsproj");
  scaffoldProject(dir, { lang: "ts" });
  addToolStub(dir, "search");
  const server = fs.readFileSync(path.join(dir, "src/server.ts"), "utf8");
  assert.match(server, /async \(args: \{ input: string \}\)/);
  assert.match(server, /requireAllowed\("search"\)/);
});

test("add-tool rejects duplicates", () => {
  const dir = scaffolded("dup");
  addToolStub(dir, "alpha");
  assert.throws(() => addToolStub(dir, "alpha"), (err) => err.code === "EDUP");
});

test("add-tool slugifies unsafe names", () => {
  const dir = scaffolded("slug");
  const { tool } = addToolStub(dir, "Do Thing Now!!");
  assert.equal(tool, "do-thing-now");
});
