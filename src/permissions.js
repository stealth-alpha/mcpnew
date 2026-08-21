// Permission manifest model. Deny-all is the only sane default.

export const MANIFEST_FILE = "mcp.permissions.json";
export const MANIFEST_VERSION = 1;

/**
 * Build a deny-all permission manifest for a server with the given tool names.
 * Every tool starts denied; operators flip entries to "allow" explicitly.
 */
export function buildDenyAllManifest(toolNames = []) {
  const tools = {};
  for (const name of toolNames) {
    tools[name] = "deny";
  }
  return {
    version: MANIFEST_VERSION,
    default: "deny",
    tools,
    resources: { default: "deny" },
    prompts: { default: "deny" },
    network: { default: "deny", allowlist: [] },
    filesystem: { default: "deny", paths: [] },
  };
}

function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate a permission manifest. Returns { ok, violations: string[] }.
 * Rules:
 *  - top-level `default` must be "deny"
 *  - no wildcard ("*") keys anywhere
 *  - every per-tool entry must be "allow" or "deny"
 *  - network/filesystem defaults must be "deny"
 */
export function validateManifest(manifest) {
  const violations = [];
  if (!isRecord(manifest)) {
    return { ok: false, violations: ["manifest is not an object"] };
  }
  if (manifest.default !== "deny") {
    violations.push(`top-level default must be "deny" (got ${JSON.stringify(manifest.default)})`);
  }
  if (manifest.version !== MANIFEST_VERSION) {
    violations.push(`unsupported manifest version: ${JSON.stringify(manifest.version)}`);
  }
  const sections = [
    ["tools", isRecord(manifest.tools) ? Object.keys(manifest.tools) : []],
    [
      "resources",
      isRecord(manifest.resources) ? Object.keys(manifest.resources) : [],
    ],
    [
      "prompts",
      isRecord(manifest.prompts) ? Object.keys(manifest.prompts) : [],
    ],
  ];
  for (const [section, keys] of sections) {
    for (const key of keys) {
      if (key === "*") {
        violations.push(`wildcard "*" key in ${section} — grants are explicit only`);
        continue;
      }
      const value = manifest[section][key];
      if (value !== "allow" && value !== "deny") {
        violations.push(
          `${section}.${key} must be "allow" or "deny" (got ${JSON.stringify(value)})`
        );
      }
    }
  }
  for (const section of ["network", "filesystem"]) {
    const cfg = manifest[section];
    if (cfg === undefined) continue;
    if (!isRecord(cfg)) {
      violations.push(`${section} must be an object`);
      continue;
    }
    if (cfg.default !== undefined && cfg.default !== "deny") {
      violations.push(`${section}.default must be "deny" (got ${JSON.stringify(cfg.default)})`);
    }
  }
  return { ok: violations.length === 0, violations };
}
