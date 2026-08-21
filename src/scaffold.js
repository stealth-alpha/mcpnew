// Scaffold engine: create project dirs from templates.

import fs from "node:fs";
import path from "node:path";
import { buildProjectFiles } from "./templates.js";
import { buildDenyAllManifest, MANIFEST_FILE } from "./permissions.js";

export function slugifyServerName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Scaffold a new MCP server project.
 * @param {string} targetDir absolute or relative directory
 * @param {{lang?: "js"|"ts", force?: boolean}} opts
 * @returns {{dir: string, files: string[]}}
 */
export function scaffoldProject(targetDir, opts = {}) {
  const lang = opts.lang === "ts" ? "ts" : "js";
  const dir = path.resolve(targetDir);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0 && !opts.force) {
    const err = new Error(`directory not empty: ${dir} (use --force to overwrite)`);
    err.code = "EEXIST";
    throw err;
  }
  const serverName = path.basename(dir);
  const files = [
    ...buildProjectFiles(serverName, lang),
    {
      path: MANIFEST_FILE,
      content:
        JSON.stringify(buildDenyAllManifest(["ping"]), null, 2) + "\n",
    },
  ];
  for (const file of files) {
    const out = path.join(dir, file.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, file.content);
  }
  return { dir, files: files.map((f) => f.path) };
}

const STUB_MARKER = "// mcpnew add-tool <name> inserts new stubs here";

/**
 * Add a typed, DENIED-by-default tool stub to a scaffolded project.
 * Inserts registration into server.{js,ts} and a manifest entry set to "deny".
 */
export function addToolStub(projectDir, toolName) {
  const dir = path.resolve(projectDir);
  const safe = slugifyServerName(toolName);
  if (!safe) throw new Error(`invalid tool name: ${toolName}`);
  const manifestPath = path.join(dir, MANIFEST_FILE);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.tools[safe] !== undefined) {
    const err = new Error(`tool already exists in manifest: ${safe}`);
    err.code = "EDUP";
    throw err;
  }
  // Manifest entry starts denied — always.
  manifest.tools[safe] = "deny";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const serverPath = ["src/server.ts", "src/server.js"]
    .map((p) => path.join(dir, p))
    .find((p) => fs.existsSync(p));
  if (!serverPath) {
    const err = new Error(`no scaffolded server found under ${dir}`);
    err.code = "ENOENT";
    throw err;
  }
  let src = fs.readFileSync(serverPath, "utf8");
  if (!src.includes(STUB_MARKER)) {
    throw new Error(`scaffold marker missing in ${serverPath}; refusing blind edit`);
  }
  const isTs = serverPath.endsWith(".ts");
  const stub = isTs
    ? `  server.tool(\n` +
      `    "${safe}",\n` +
      `    "TODO: describe ${safe}.",\n` +
      `    {\n` +
      `      input: z.string().describe("Primary input for ${safe}"),\n` +
      `    },\n` +
      `    async (args: { input: string }) => {\n` +
      `      requireAllowed("${safe}"); // denied until you flip the manifest\n` +
      `      await auditToolCall("${safe}")(args);\n` +
      `      // TODO: implement ${safe}\n` +
      `      return { content: [{ type: "text" as const, text: "not implemented" }] };\n` +
      `    }\n` +
      `  );\n\n`
    : `  server.tool(\n` +
      `    "${safe}",\n` +
      `    "TODO: describe ${safe}.",\n` +
      `    { input: z.string().describe("Primary input for ${safe}") },\n` +
      `    async (args) => {\n` +
      `      requireAllowed("${safe}"); // denied until you flip the manifest\n` +
      `      await auditToolCall("${safe}")(args);\n` +
      `      // TODO: implement ${safe}\n` +
      `      return { content: [{ type: "text", text: "not implemented" }] };\n` +
      `    }\n` +
      `  );\n\n`;
  src = src.replace(STUB_MARKER, stub + STUB_MARKER);
  fs.writeFileSync(serverPath, src);
  return { tool: safe, manifestPath, serverPath };
}
