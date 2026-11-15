import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeIfApplies, claudeMatches } from "../src/agents/claude.js";
import { AGENTS } from "../src/agents/index.js";
import { evaluateIf, matchCall } from "../src/match.js";
import { evalIfRule } from "../src/permissionRule.js";
import { resolveTool } from "../src/tools.js";
import { UsageError } from "../src/model.js";
import { cli, cliJson, entry, EXAMPLE } from "./helpers.js";

const mcp = resolveTool("mcp:memory/create_entities");

describe("AC-2 matcher semantics per agent", () => {
  it("claude: mcp__memory is an exact name -> 0 hits; mcp__memory__.* is a regex -> 1 hit", () => {
    const names = mcp.claude as string[];
    expect(names).toEqual(["mcp__memory__create_entities"]);
    expect(claudeMatches("mcp__memory", names).matched).toBe(false);
    expect(claudeMatches("mcp__memory__.*", names).matched).toBe(true);
  });

  it("codex: mcp__memory is an unanchored regex -> 1 hit", () => {
    expect(AGENTS.codex.matches("mcp__memory", mcp.codex as string[]).matched).toBe(true);
  });

  it("gemini: names are mcp_<server>_<tool>; mcp__memory 0 hits, mcp_memory_.* 1 hit", () => {
    const names = mcp.gemini as string[];
    expect(names).toEqual(["mcp_memory_create_entities"]);
    expect(AGENTS.gemini.matches("mcp__memory", names).matched).toBe(false);
    expect(AGENTS.gemini.matches("mcp_memory_.*", names).matched).toBe(true);
  });

  it("claude: Edit|Write is an exact list (NotebookEdit does not match)", () => {
    expect(claudeMatches("Edit|Write", ["Edit"])).toEqual({ matched: true, kind: "exact" });
    expect(claudeMatches("Edit|Write", ["Write"]).matched).toBe(true);
    expect(claudeMatches("Edit|Write", ["NotebookEdit"]).matched).toBe(false);
    expect(claudeMatches("Edit, Write", ["Write"]).matched).toBe(true);
  });

  it("claude: a matcher with other characters is an unanchored regex", () => {
    expect(claudeMatches("^Notebook.*", ["NotebookEdit"])).toEqual({ matched: true, kind: "regex" });
    expect(claudeMatches("Edit.*", ["MultiEdit"]).matched).toBe(true);
    expect(claudeMatches("[", ["Edit"])).toEqual({ matched: false, kind: "invalid" });
  });

  it("*, empty and missing matchers select everything in every agent", () => {
    for (const a of ["claude", "codex", "gemini", "antigravity"] as const) {
      for (const m of ["*", "", undefined]) expect(AGENTS[a].matches(m, ["anything"])).toEqual({ matched: true, kind: "all" });
    }
  });

  it("codex: an Edit matcher matches an apply_patch call", () => {
    const edit = resolveTool("edit");
    expect(edit.codex).toEqual(["apply_patch", "Edit", "Write"]);
    expect(AGENTS.codex.matches("Edit", edit.codex as string[]).matched).toBe(true);
    expect(AGENTS.codex.matches("^Edit$", ["apply_patch"]).matched).toBe(false);
  });

  it("resolves tool names per agent and rejects unknown tools", () => {
    expect(resolveTool("shell")).toMatchObject({ claude: ["Bash"], gemini: ["run_shell_command"], antigravity: ["run_command"] });
    expect(resolveTool("mcp__github__create_issue").gemini).toEqual(["mcp_github_create_issue"]);
    expect(resolveTool("gemini:read_file")).toEqual({ gemini: ["read_file"] });
    expect(resolveTool("read").codex).toBeUndefined();
    expect(() => resolveTool("frobnicate")).toThrow(UsageError);
  });
});

describe("AC-2 Claude `if` filter", () => {
  it("Bash(git push*) is true only for git push", () => {
    const rule = "Bash(git push*)";
    expect(evalIfRule(rule, "Bash", { command: "git push origin main" })).toBe(true);
    expect(evalIfRule(rule, "Bash", { command: "git pull" })).toBe(false);
    expect(evalIfRule(rule, "Bash", { command: "echo git push" })).toBe(false);
    expect(evalIfRule(rule, "Edit", { command: "git push" })).toBe(false);
  });

  it("supports bare tool names, the prefix:* form and file rules", () => {
    expect(evalIfRule("Bash", "Bash", { command: "anything" })).toBe(true);
    expect(evalIfRule("Bash(npm:*)", "Bash", { command: "npm test" })).toBe(true);
    expect(evalIfRule("Bash(npm:*)", "Bash", { command: "npmx test" })).toBe(false);
    expect(evalIfRule("Edit(src/*.ts)", "Edit", { file_path: "src/a.ts" })).toBe(true);
    expect(evalIfRule("Edit(src/*.ts)", "Edit", { file_path: "lib/a.ts" })).toBe(false);
  });

  it("`if` on a non-tool event never runs", () => {
    expect(claudeIfApplies("PreToolUse")).toBe(true);
    expect(claudeIfApplies("Stop")).toBe(false);
    const stop = entry("claude", "true", { event: "Stop", ifRule: "Bash(ls)" });
    expect(evaluateIf(stop, "Bash", { command: "ls" })).toBe("never-runs");
  });

  it("other agents ignore `if`", () => {
    const e = entry("codex", "true", { ifRule: "Bash(git push*)" });
    expect(evaluateIf(e, "Bash", { command: "ls" })).toBe("ignored");
  });
});

describe("AC-2 match command", () => {
  it("reproduces the mcp results on examples/crossagent", async () => {
    const { code, data } = await cliJson(["match", "--dir", EXAMPLE, "--tool", "mcp:memory/create_entities"], { LANG: "C" });
    expect(code).toBe(0);
    const hits = Object.fromEntries(data.agents.map((a: any) => [a.agent, a.hitCount]));
    expect(hits).toEqual({ claude: 0, codex: 1, gemini: 0 });
  });

  it("applies the `if` filter: slow hook fires on claude only for git push", async () => {
    const push = await cliJson(["match", "--dir", EXAMPLE, "--tool", "shell", "--input", '{"command":"git push origin main"}'], { LANG: "C" });
    const ls = await cliJson(["match", "--dir", EXAMPLE, "--tool", "shell", "--input", '{"command":"ls"}'], { LANG: "C" });
    const claudeCommands = (d: any): string[] => d.agents.find((a: any) => a.agent === "claude").hits.map((h: any) => h.command);
    expect(claudeCommands(push.data)).toContain("node hooks/slow.mjs");
    expect(claudeCommands(ls.data)).not.toContain("node hooks/slow.mjs");
    const codexLs = ls.data.agents.find((a: any) => a.agent === "codex").hits.map((h: any) => h.command);
    expect(codexLs).toContain("node hooks/slow.mjs"); // codex ignores `if`
  });

  it("skips agents with no counterpart tool instead of failing", () => {
    const entries = [entry("claude", "true"), entry("codex", "true")];
    const [claude, codex] = matchCall(entries, "read", {}, ["claude", "codex"]);
    expect(claude?.toolName).toBe("Read");
    expect(codex?.toolName).toBeNull();
  });

  it("never executes a hook command (no side-effect file)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hp-noexec-"));
    mkdirSync(join(dir, ".claude"));
    const marker = join(dir, "marker");
    const config = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: `touch "${marker}"` }] }] } };
    writeFileSync(join(dir, ".claude/settings.json"), JSON.stringify(config));
    const m = await cli(["match", "--dir", dir, "--tool", "shell"], { LANG: "C" });
    expect(m.code).toBe(0);
    expect(m.stdout).toContain("touch");
    const l = await cli(["lint", "--dir", dir], { LANG: "C" });
    expect(l.code).toBe(0);
    expect(existsSync(marker)).toBe(false);
    // control: run does execute the hook, so the check above is meaningful
    await cli(["run", "--dir", dir, "--tool", "shell"], { LANG: "C" });
    expect(existsSync(marker)).toBe(true);
  });
});
