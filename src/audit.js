// `mcpnew audit` — verify a scaffolded project kept its security posture.

import fs from "node:fs";
import path from "node:path";
import { MANIFEST_FILE, validateManifest } from "./permissions.js";

/**
 * Audit a scaffolded MCP project.
 * @returns {{ok: boolean, findings: {level:"error"|"warn", msg:string}[]}}
 */
export function auditProject(projectDir) {
  const dir = path.resolve(projectDir);
  const findings = [];

  const manifestPath = path.join(dir, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      findings: [{ level: "error", msg: `missing ${MANIFEST_FILE}` }],
    };
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return {
      ok: false,
      findings: [
        { level: "error", msg: `${MANIFEST_FILE} is not valid JSON: ${err.message}` },
      ],
    };
  }

  const { ok, violations } = validateManifest(manifest);
  for (const v of violations) findings.push({ level: "error", msg: v });

  const serverPath = ["src/server.ts", "src/server.js"]
    .map((p) => path.join(dir, p))
    .find((p) => fs.existsSync(p));
  if (!serverPath) {
    findings.push({ level: "error", msg: "no src/server.ts or src/server.js found" });
    return { ok: false, findings };
  }
  const serverSrc = fs.readFileSync(serverPath, "utf8");

  // Audit hook must be imported and actually invoked.
  if (!/auditToolCall\s*\(\s*"/.test(serverSrc)) {
    findings.push({
      level: "error",
      msg: "audit hook not wired: auditToolCall is never referenced in server source",
    });
  }
  // Every registered tool must be gated by requireAllowed.
  const toolDecls = [...serverSrc.matchAll(/server\.tool\(\s*"([^"]+)"/g)].map(
    (m) => m[1]
  );
  for (const tool of toolDecls) {
    if (!serverSrc.includes(`requireAllowed("${tool}")`)) {
      findings.push({
        level: "error",
        msg: `tool "${tool}" has no requireAllowed() gate`,
      });
    }
    if (!(tool in (manifest.tools || {}))) {
      findings.push({
        level: "error",
        msg: `tool "${tool}" registered but absent from ${MANIFEST_FILE}`,
      });
    }
  }
  // Manifest tools that don't exist in the server are just stale — warn.
  for (const tool of Object.keys(manifest.tools || {})) {
    if (!toolDecls.includes(tool)) {
      findings.push({
        level: "warn",
        msg: `manifest entry "${tool}" has no matching server.tool() registration`,
      });
    }
  }
  // logs must be gitignored so audit trails never get committed accidentally.
  const giPath = path.join(dir, ".gitignore");
  if (fs.existsSync(giPath)) {
    const gi = fs.readFileSync(giPath, "utf8");
    if (!/^logs\/?$/m.test(gi)) {
      findings.push({ level: "warn", msg: ".gitignore does not exclude logs/" });
    }
  } else {
    findings.push({ level: "warn", msg: "no .gitignore found" });
  }

  return { ok: !findings.some((f) => f.level === "error"), findings };
}
