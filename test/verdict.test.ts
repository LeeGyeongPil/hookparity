import { describe, expect, it } from "vitest";
import { AGENTS } from "../src/agents/index.js";
import type { AgentId } from "../src/model.js";
import type { HookRun } from "../src/runner.js";
import { entry, runOne } from "./helpers.js";

const THREE: AgentId[] = ["claude", "codex", "gemini"];

function fakeRun(over: Partial<HookRun>): HookRun {
  return { code: 0, signal: null, timedOut: false, ms: 1, stdout: "", stderr: "", timeoutSec: 30, capped: false, ...over };
}

describe("AC-4 verdict rules", () => {
  it.each(THREE)("%s: exit 2 blocks and keeps stderr as the reason", async (agent) => {
    const r = await runOne(agent, "echo no >&2; exit 2");
    expect(r.verdict).toBe("block");
    expect(r.report.results[0]?.reason).toBe("no");
    expect(r.ids).toEqual([]);
  });

  it.each(THREE)("%s: exit 1 is not a block (HP102)", async (agent) => {
    const r = await runOne(agent, "echo oops >&2; exit 1");
    expect(r.verdict).toBe("allow");
    expect(r.ids).toContain("HP102");
  });

  it("other non-zero exit codes do not block either", async () => {
    const r = await runOne("claude", "exit 3");
    expect(r.verdict).toBe("allow");
    expect(r.ids).toEqual(["HP102"]);
  });

  it.each(THREE)("%s: timeout allows with HP104 and the process dies within timeout + 1s", async (agent) => {
    const r = await runOne(agent, "sleep 3", { timeoutSec: 1 });
    expect(r.verdict).toBe("allow");
    expect(r.ids).toContain("HP104");
    expect(r.ms).toBeLessThan(2000);
  });

  it("claude: a timeout blocks only with onFailure:block", async () => {
    const r = await runOne("claude", "sleep 3", { timeoutSec: 1, onFailure: "block" });
    expect(r.verdict).toBe("block");
    expect(r.ids).toContain("HP104");
  });

  it("kills grandchildren on timeout (no waiting for a stray process)", async () => {
    const r = await runOne("gemini", "sh -c 'sleep 5' & wait", { timeoutSec: 1 });
    expect(r.ms).toBeLessThan(2500);
  });

  it("--max-timeout shortens long timeouts and marks them capped", async () => {
    const r = await runOne("claude", "sleep 3", { timeoutSec: 600 }, { maxTimeoutSec: 1 });
    expect(r.ids).toContain("HP104");
    expect(r.report.results[0]?.hooks[0]?.run?.capped).toBe(true);
    expect(r.ms).toBeLessThan(2500);
  });

  it("codex: permissionDecision ask is unsupported -> allow + HP103", async () => {
    const r = await runOne("codex", `printf '%s' '{"hookSpecificOutput":{"permissionDecision":"ask"}}'`);
    expect(r.verdict).toBe("allow");
    expect(r.ids).toContain("HP103");
  });

  it("claude: permissionDecision ask stays ask", async () => {
    const r = await runOne("claude", `printf '%s' '{"hookSpecificOutput":{"permissionDecision":"ask"}}'`);
    expect(r.verdict).toBe("ask");
  });

  it("gemini: top-level decision deny blocks; block too", async () => {
    expect((await runOne("gemini", `printf '%s' '{"decision":"deny","reason":"x"}'`)).verdict).toBe("block");
    expect((await runOne("gemini", `printf '%s' '{"decision":"block"}'`)).verdict).toBe("block");
  });

  it("gemini: Claude-shaped deny is not read -> allow + HP101", async () => {
    const r = await runOne("gemini", `printf '%s' '{"hookSpecificOutput":{"permissionDecision":"deny"}}'`);
    expect(r.verdict).toBe("allow");
    expect(r.ids).toContain("HP101");
  });

  it("claude and codex read hookSpecificOutput deny", async () => {
    for (const agent of ["claude", "codex"] as const) {
      const r = await runOne(agent, `printf '%s' '{"hookSpecificOutput":{"permissionDecision":"deny"}}'`);
      expect(r.verdict).toBe("block");
    }
  });

  it("claude and codex accept the legacy top-level decision block; other values give HP101", () => {
    for (const agent of ["claude", "codex"] as const) {
      const block = AGENTS[agent].decide(fakeRun({ stdout: '{"decision":"block","reason":"r"}' }), entry(agent, "x"));
      expect(block.decision).toBe("block");
      const deny = AGENTS[agent].decide(fakeRun({ stdout: '{"decision":"deny"}' }), entry(agent, "x"));
      expect(deny.decision).toBe("allow");
      expect(deny.findings.map((f) => f.id)).toEqual(["HP101"]);
    }
  });

  it.each(THREE)("%s: invalid JSON on stdout with exit 0 -> allow + warning HP105", async (agent) => {
    const r = await runOne(agent, "echo '{bad'");
    expect(r.verdict).toBe("allow");
    expect(r.ids).toContain("HP105");
  });

  it("empty stdout with exit 0 is a plain allow", async () => {
    const r = await runOne("gemini", "true");
    expect(r.verdict).toBe("allow");
    expect(r.ids).toEqual([]);
  });

  it("antigravity: top-level decision deny blocks (experimental)", async () => {
    expect((await runOne("antigravity", `printf '%s' '{"decision":"deny"}'`)).verdict).toBe("block");
    expect((await runOne("antigravity", `printf '%s' '{"decision":"auto_approve"}'`)).verdict).toBe("allow");
  });

  it("the strictest hook wins when several fire", async () => {
    const { matchCall } = await import("../src/match.js");
    const { executeMatches } = await import("../src/run.js");
    const entries = [entry("gemini", "true"), entry("gemini", "exit 2")];
    const report = await executeMatches(matchCall(entries, "shell", {}, ["gemini"]), { dir: process.cwd(), input: {}, maxTimeoutSec: 5 });
    expect(report.verdicts.gemini).toBe("block");
  });

  it("does not execute non-command handlers", async () => {
    const r = await runOne("claude", "unused", { type: "http", command: undefined });
    expect(r.verdict).toBe("allow");
    expect(r.report.results[0]?.hooks[0]?.run).toBeUndefined();
  });
});
