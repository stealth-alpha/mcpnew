import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "mcpnew.js");

function run(args, opts = {}) {
  return execFileSync(process.execPath, [BIN, ...args], {
    encoding: "utf8",
    ...opts,
  });
}

function runFail(args, opts = {}) {
  try {
    return {
      status: execFileSync(process.execPath, [BIN, ...args], { encoding: "utf8", ...opts }),
      code: 0,
    };
  } catch (err) {
    return { status: err.stdout || "", code: err.status };
  }
}

test("bin prints version", () => {
  const out = run(["--version"]);
  assert.match(out, /^0\.1\.0/);
});

test("bin prints help and exits 0", () => {
  const out = run(["--help"]);
  assert.match(out, /Usage:/);
  assert.match(out, /mcpnew create/);
  assert.match(out, /mcpnew audit/);
});

test("bin create scaffolds into a directory", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "mcpnew-cli-"));
  const out = run(["create", "my-server", "--lang", "js"], { cwd: base });
  assert.match(out, /scaffolded/);
  assert.ok(fs.existsSync(path.join(base, "my-server", "src", "server.js")));
});

test("bin audit passes on fresh scaffold and fails on tampered manifest", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "mcpnew-cli2-"));
  run(["create", "srv"], { cwd: base });
  const dir = path.join(base, "srv");
  assert.equal(run(["audit", "--dir", dir]).includes("audit passed"), true);

  const p = path.join(dir, "mcp.permissions.json");
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  m.default = "allow";
  fs.writeFileSync(p, JSON.stringify(m));
  const { code } = runFail(["audit", "--dir", dir]);
  assert.notEqual(code, 0);
});

test("bin rejects unknown commands with exit 1", () => {
  const { code } = runFail(["frobnicate"]);
  assert.equal(code, 1);
});
