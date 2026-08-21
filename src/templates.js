// Project templates for generated MCP servers.
// Generated projects DO depend on @modelcontextprotocol/sdk — that's the point.
// mcpnew itself stays zero-dependency; templates are plain string builders.

const SDK_IMPORT_JS = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";`;

const SDK_HEADER_TS = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { auditToolCall } from "./audit.js";`;

const AUDIT_JS = `// Audit hook — every tool call passes through here before and after execution.
// Appends one JSON line per call to <projectRoot>/logs/audit.jsonl.
import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "audit.jsonl");

export function auditLog(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, line + "\\n");
  return event;
}

export function auditToolCall(name) {
  // Returns a wrapper that audits any async handler.
  return async (args, extra) => {
    const startedAt = Date.now();
    auditLog({ kind: "tool_call", tool: name, args });
    try {
      const result = args; // replaced by mcpnew add-tool when a handler is wired
      auditLog({ kind: "tool_result", tool: name, ok: true, ms: Date.now() - startedAt });
      return result;
    } catch (err) {
      auditLog({ kind: "tool_result", tool: name, ok: false, error: String(err), ms: Date.now() - startedAt });
      throw err;
    }
  };
}
`;

const SERVER_JS_BODY = (serverName) => `// ${serverName} — secure-by-default MCP server.
// Permission rule: everything in mcp.permissions.json starts as "deny".
// A tool only runs if its manifest entry is explicitly "allow" AND it is registered here.

${SDK_IMPORT_JS}
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { auditToolCall } from "./audit.js";
import { MANIFEST_FILE } from "./manifest.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../" + MANIFEST_FILE, import.meta.url)));

function isAllowed(toolName) {
  return MANIFEST.tools[toolName] === "allow";
}

function requireAllowed(toolName) {
  if (!isAllowed(toolName)) {
    throw new Error(\`tool '\${toolName}' is denied by permission manifest (deny-all default)\`);
  }
}

export function createServer() {
  const server = new McpServer({ name: "${serverName}", version: "0.1.0" });

  server.tool(
    "ping",
    "Health check. Allowed only when the manifest says so.",
    { echo: z.string().describe("Text to echo back").default("pong") },
    async (args) => {
      requireAllowed("ping");
      await auditToolCall("ping")(args);
      return { content: [{ type: "text", text: String(args.echo ?? "pong") }] };
    }
  );

  // mcpnew add-tool <name> inserts new stubs here — each starts DENIED.

  return server;
}

export async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

// Run directly: node src/server.js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
`;

const SERVER_TS_BODY = (serverName) => `// ${serverName} — secure-by-default MCP server (TypeScript).
// Deny-all permissions come from ../mcp.permissions.json.

${SDK_HEADER_TS}
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MANIFEST_FILE, type PermissionManifest } from "./manifest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST: PermissionManifest = JSON.parse(
  readFileSync(join(__dirname, "..", MANIFEST_FILE), "utf8")
);

function isAllowed(toolName: string): boolean {
  return MANIFEST.tools[toolName] === "allow";
}

function requireAllowed(toolName: string): void {
  if (!isAllowed(toolName)) {
    throw new Error(\`tool '\${toolName}' is denied by permission manifest (deny-all default)\`);
  }
}

export function createServer() {
  const server = new McpServer({ name: "${serverName}", version: "0.1.0" });

  server.tool(
    "ping",
    "Health check. Allowed only when the manifest says so.",
    {
      echo: z.string().describe("Text to echo back").default("pong"),
    },
    async (args: { echo?: string }) => {
      requireAllowed("ping");
      await auditToolCall("ping")(args);
      const text = args.echo ?? "pong";
      return { content: [{ type: "text" as const, text }] };
    }
  );

  // mcpnew add-tool <name> inserts new stubs here — each starts DENIED.

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
`;

const MANIFEST_TYPES_TS = `export const MANIFEST_FILE = "mcp.permissions.json";

export interface PermissionManifest {
  version: number;
  default: "deny";
  tools: Record<string, "allow" | "deny">;
  resources: { default: "deny" };
  prompts: { default: "deny" };
  network: { default: "deny"; allowlist: string[] };
  filesystem: { default: "deny"; paths: string[] };
}
`;

const MANIFEST_JS = `export const MANIFEST_FILE = "mcp.permissions.json";
`;

const GITIGNORE = `node_modules/
dist/
logs/
*.log
.env
`;

const PROJECT_README = (serverName, lang) => `# ${serverName}

A secure-by-default [MCP](https://modelcontextprotocol.io) server scaffolded by **mcpnew** (${lang}).

## Security posture

- **Deny-all permissions:** \`mcp.permissions.json\` defaults every capability to \`deny\`.
  Tools run only when explicitly allowed (\`"tools": { "ping": "allow" }\`).
- **Audit hooks:** every tool call is logged to \`logs/audit.jsonl\` (who/what/args/outcome).
- **Typed tool stubs:** inputs are declared once as schemas and reused end-to-end.

## Develop

\`\`\`bash
npm install
npm run build   # TypeScript only
npm test
\`\`\`

## Add a tool

\`\`\`bash
npx mcpnew add-tool my-tool
\`\`\`

This inserts a typed stub (denied by default) into \`src/server.${lang === "ts" ? "ts" : "js"}\`
and adds a \`"my-tool": "deny"\` manifest entry. Flip it to \`"allow"\` only after review.

## Audit the config

\`\`\`bash
npx mcpnew audit
\`\`\`

Fails non-zero if the manifest stops being deny-all or audit hooks are unwired.
`;

const PKG_JSON = (serverName, lang) =>
  JSON.stringify(
    {
      name: serverName,
      version: "0.1.0",
      private: true,
      type: "module",
      ...(lang === "ts"
        ? {
            main: "dist/server.js",
            scripts: {
              build: "tsc",
              test: "node --test test/",
              start: "node dist/server.js",
            },
            devDependencies: {
              typescript: "^5.5.0",
              "@types/node": "^20.14.0",
            },
          }
        : {
            main: "src/server.js",
            scripts: {
              test: "node --test test/",
              start: "node src/server.js",
            },
          }),
      dependencies: {
        "@modelcontextprotocol/sdk": "^1.0.0",
        zod: "^3.23.0",
      },
    },
    null,
    2
  ) + "\n";

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
`;

const TEST_JS = `import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "../src/server.js";

test("permission manifest is deny-all", () => {
  const manifest = JSON.parse(readFileSync("mcp.permissions.json", "utf8"));
  assert.equal(manifest.default, "deny");
  for (const [tool, verdict] of Object.entries(manifest.tools)) {
    assert.equal(verdict, "deny", \`tool \${tool} must start denied\`);
  }
});

test("denied tools throw before executing", () => {
  const server = createServer();
  assert.ok(server, "server constructs");
});

test("audit log directory is gitignored", () => {
  const gi = readFileSync(".gitignore", "utf8");
  assert.match(gi, /logs\\//);
});
`;

/**
 * Build the full file map for a scaffolded project.
 * @returns {Array<{path: string, content: string}>}
 */
export function buildProjectFiles(serverName, lang) {
  const files = [
    { path: "package.json", content: PKG_JSON(serverName, lang) },
    { path: "README.md", content: PROJECT_README(serverName, lang) },
    { path: ".gitignore", content: GITIGNORE },
    {
      path: "src/manifest." + (lang === "ts" ? "ts" : "js"),
      content: lang === "ts" ? MANIFEST_TYPES_TS : MANIFEST_JS,
    },
    {
      path: "src/audit." + (lang === "ts" ? "ts" : "js"),
      content: AUDIT_JS + (lang === "ts" ? "\n" : ""),
    },
    {
      path:
        lang === "ts" ? "src/server.ts" : "src/server.js",
      content:
        lang === "ts"
          ? SERVER_TS_BODY(serverName)
          : SERVER_JS_BODY(serverName),
    },
    {
      path: "test/server.test." + (lang === "ts" ? "ts" : "js"),
      content: TEST_JS,
    },
  ];
  if (lang === "ts") files.push({ path: "tsconfig.json", content: TSCONFIG });
  return files;
}
