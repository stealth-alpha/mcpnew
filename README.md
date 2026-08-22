# mcpnew

[![Test](https://github.com/stealth-alpha/mcpnew/actions/workflows/test.yml/badge.svg)](https://github.com/stealth-alpha/mcpnew/actions/workflows/test.yml)

**Scaffold secure-by-default MCP servers** — TypeScript or JavaScript, with deny-all permissions, typed tool stubs, and audit hooks pre-wired.

## The problem

Every hand-rolled MCP server starts the same way: copy a demo from the docs, register tools as you go, and hope nobody asks "wait, can that tool read my home directory?" Permissions end up allow-all by accident. Audit logging is a TODO. Input schemas drift from handlers.

`mcpnew` inverts the default. Every capability your server exposes starts **denied**, every tool call flows through an **audit hook**, and every tool stub is **typed once** at the schema level.

## Install

```bash
npm install -g mcpnewcli
```

Zero runtime dependencies. Node 18+.

## 30-second quickstart

```bash
# 1. Scaffold (JavaScript default; add --lang ts for TypeScript)
mcpnew create my-server && cd my-server && npm install

# 2. Add a typed tool stub — it lands DENIED in mcp.permissions.json
npx mcpnew add-tool search-files

# 3. Review, implement, then explicitly allow:
#    "tools": { "search-files": "allow" }

# 4. Keep yourself honest
npx mcpnew audit
```

That's it. `mcpnew audit` fails non-zero if the manifest stops being deny-all, if any registered tool lacks its `requireAllowed()` gate, or if audit hooks are unwired — wire it into CI and stay secure by construction.

## What you get

```
my-server/
├── src/server.js          # MCP server: typed tool stubs + permission gates + audit hooks
├── src/audit.js           # JSONL audit trail → logs/audit.jsonl (gitignored)
├── src/manifest.js        # manifest loader (+ TS types on --lang ts)
├── test/server.test.js    # tests asserting the deny-all posture holds
└── mcp.permissions.json   # deny-all permission manifest — the source of truth
```

- **Deny-all permissions** — tools, resources, prompts, network, filesystem: everything defaults to `deny`. Wildcards are rejected outright.
- **Typed tool stubs** — `mcpnew add-tool <name>` inserts a zod-schema'd stub wired through the gate and the audit hook. You write the body; the scaffolding is already correct.
- **Audit hooks pre-wired** — every call logs timestamp, tool, args, outcome, and duration to `logs/audit.jsonl`.

## Config

The generated `mcp.permissions.json`:

```json
{
  "version": 1,
  "default": "deny",
  "tools": { "ping": "deny" },
  "resources": { "default": "deny" },
  "prompts": { "default": "deny" },
  "network": { "default": "deny", "allowlist": [] },
  "filesystem": { "default": "deny", "paths": [] }
}
```

Flip entries to `"allow"` deliberately, one at a time, after reading what the tool does. `mcpnew audit` verifies you haven't loosened more than you meant to.

## Pro

Shipping MCP servers to production teams? **mcpnew Pro** ($9/mo) adds policy-as-code review workflows: pull-request diffs of permission manifests with required sign-off before any `deny` flips to `allow`, org-wide audit-log shipping (Splunk/Datadog/Loki), and a compliance report mapping each tool grant to its approval record. One tier, no seat math. License via Gumroad — link placeholder.

## License

MIT

---

Part of the [stealth-alpha toolkit](https://stealth-alpha.github.io/toolkit/) — eight zero-dependency CLIs for release automation, agent security, and repo hygiene.
