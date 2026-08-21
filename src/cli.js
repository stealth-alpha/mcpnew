// mcpnew CLI — scaffold secure-by-default MCP servers.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { log, info, success, error, warn, green, cyan, dim, bold } from "./util.js";
import { scaffoldProject, addToolStub } from "./scaffold.js";
import { auditProject } from "./audit.js";

export const VERSION = "0.1.0";

const HELP = `mcpnew ${VERSION} — secure-by-default MCP server scaffolding

Usage:
  mcpnew create <dir> [--lang js|ts] [--force]   Scaffold a new MCP server project
  mcpnew add-tool <name> [--dir <path>]          Add a typed tool stub (denied by default)
  mcpnew audit [--dir <path>]                    Verify deny-all posture + audit wiring
  mcpnew --version                               Print version
  mcpnew --help                                  Show this help

Defaults are deny-all: every tool, resource, and network/filesystem scope in
mcp.permissions.json starts denied. Audit hooks log every call to logs/audit.jsonl.
`;

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

export function main(argv) {
  const { flags, positional } = parseArgs(argv);
  const command = positional[0] || "--help";

  if (flags.version || command === "--version" || command === "-v") {
    log(VERSION);
    return 0;
  }
  if (flags.help || command === "--help" || command === "-h" || command === "help") {
    log(HELP);
    return 0;
  }

  try {
    switch (command) {
      case "create":
      case "init": {
        const dir = positional[1];
        if (!dir) {
          error("create requires a target directory: mcpnew create my-server");
          return 1;
        }
        const lang = flags.lang === "ts" || flags.lang === "typescript" ? "ts" : "js";
        const { dir: absDir, files } = scaffoldProject(dir, {
          lang,
          force: Boolean(flags.force),
        });
        success(`scaffolded ${bold(path.basename(absDir))} (${lang}) in ${dim(absDir)}`);
        for (const f of files) log(`  ${dim("+")} ${f}`);
        log("");
        info("next steps:");
        log(`  ${cyan(`cd ${dir}`)}`);
        log(`  ${cyan("npm install")}`);
        log(`  ${cyan(`npx mcpnew add-tool my-tool`)}   ${dim("# typed stub, denied by default")}`);
        log(`  ${cyan(`npx mcpnew audit`)}              ${dim("# keep the deny-all posture honest")}`);
        return 0;
      }

      case "add-tool": {
        const toolName = positional[1];
        if (!toolName) {
          error("add-tool requires a name: mcpnew add-tool my-tool");
          return 1;
        }
        const dir = flags.dir ? path.resolve(String(flags.dir)) : process.cwd();
        if (!fs.existsSync(path.join(dir, "mcp.permissions.json"))) {
          error(`no mcp.permissions.json in ${dir} — run inside a scaffolded project (or pass --dir)`);
          return 1;
        }
        const { tool } = addToolStub(dir, toolName);
        success(`added tool stub ${bold(tool)}`);
        warn(`"${tool}" is DENIED in mcp.permissions.json — flip to "allow" only after review.`);
        return 0;
      }

      case "audit": {
        const dir = flags.dir ? path.resolve(String(flags.dir)) : process.cwd();
        const { ok, findings } = auditProject(dir);
        for (const f of findings) {
          const tag = f.level === "error" ? error : warn;
          tag(`${f.level}: ${f.msg}`);
        }
        if (ok) {
          success(`audit passed: deny-all posture intact, audit hooks wired (${dim(dir)})`);
          return 0;
        }
        error(`audit FAILED for ${dir}`);
        return 1;
      }

      default:
        error(`unknown command: ${command}`);
        log(HELP);
        return 1;
    }
  } catch (err) {
    if (err && err.code === "EEXIST") {
      error(err.message);
    } else {
      error(err && err.message ? err.message : String(err));
      if (process.env.MCPNEW_DEBUG && err && err.stack) error(dim(err.stack));
    }
    return 1;
  }
}
