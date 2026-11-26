import { describe, expect, it } from "vitest";
import { cli, cliJson, EXAMPLE, FIXED } from "./helpers.js";

const CURL = '{"command":"curl https://example.com"}';

describe("AC-3 run", () => {
  it("claude and codex block curl, gemini allows it (HP101), verdicts diverge", async () => {
    const { code, data } = await cliJson(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL], { LANG: "C" });
    expect(code).toBe(0);
    expect(data.verdicts).toEqual({ claude: "block", codex: "block", gemini: "allow" });
    expect(data.divergent).toBe(true);
    const gemini = data.results.find((r: any) => r.agent === "gemini");
    expect(gemini.findings.map((f: any) => f.id)).toContain("HP101");
    expect(gemini.findings.find((f: any) => f.id === "HP101").message).toContain("decision");
  });

  it("passes each agent its own stdin fixture", async () => {
    const { data } = await cliJson(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL], { LANG: "C" });
    const by = (agent: string): any => data.results.find((r: any) => r.agent === agent);
    expect(by("claude").toolName).toBe("Bash");
    expect(by("codex").toolName).toBe("Bash");
    expect(by("gemini").toolName).toBe("run_shell_command");
  });

  it("--fail-on-divergence exits 1 when agents disagree", async () => {
    const r = await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL, "--fail-on-divergence"], { LANG: "C" });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("<--");
    expect(r.stdout).toContain("Agents disagree");
  });

  it("lists the commands it will execute before running them", async () => {
    const r = await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL], { LANG: "C" });
    expect(r.stderr).toContain("About to run");
    expect(r.stderr).toContain("[gemini] node hooks/guard.mjs");
  });

  it("examples/fixed: every agent blocks, exit 0 even with --fail-on-divergence", async () => {
    const r = await cli(["run", "--dir", FIXED, "--tool", "shell", "--input", CURL, "--fail-on-divergence", "--json"], { LANG: "C" });
    const data = JSON.parse(r.stdout);
    expect(data.verdicts).toEqual({ claude: "block", codex: "block", gemini: "block" });
    expect(data.divergent).toBe(false);
    expect(r.code).toBe(0);
    expect(data.results.flatMap((x: any) => x.findings.map((f: any) => f.id))).not.toContain("HP101");
  });

  it("exit 2 blocks everywhere; plain commands are allowed everywhere", async () => {
    const rm = await cliJson(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", '{"command":"rm -rf build"}'], { LANG: "C" });
    expect(rm.data.verdicts).toEqual({ claude: "block", codex: "block", gemini: "block" });
    expect(rm.data.divergent).toBe(false);
    const ls = await cliJson(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", '{"command":"ls"}'], { LANG: "C" });
    expect(ls.data.verdicts).toEqual({ claude: "allow", codex: "allow", gemini: "allow" });
  });

  it("antigravity runs only when listed in --agents, and is flagged experimental", async () => {
    const off = await cliJson(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL], { LANG: "C" });
    expect(Object.keys(off.data.verdicts)).not.toContain("antigravity");
    const on = await cliJson(["run", "--dir", EXAMPLE, "--agents", "claude,antigravity", "--tool", "shell", "--input", CURL], { LANG: "C" });
    const ag = on.data.results.find((r: any) => r.agent === "antigravity");
    expect(ag.experimental).toBe(true);
    expect(ag.toolName).toBe("run_command");
    expect(ag.verdict).toBe("allow"); // Claude-shaped JSON is not read there either (HP101)
    expect(ag.findings.map((f: any) => f.id)).toContain("HP101");
  });

  it("skips agents that have no counterpart tool", async () => {
    const { data } = await cliJson(["run", "--dir", EXAMPLE, "--tool", "read"], { LANG: "C" });
    const codex = data.results.find((r: any) => r.agent === "codex");
    expect(codex.verdict).toBeNull();
    expect(data.verdicts.codex).toBeUndefined();
  });
});

describe("run usage errors", () => {
  it("requires --tool", async () => {
    const r = await cli(["run", "--dir", EXAMPLE], { LANG: "C" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--tool is required");
  });
  it("rejects invalid --input", async () => {
    const r = await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", "{nope"], { LANG: "C" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--input is not valid JSON");
    const arr = await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", "[1]"], { LANG: "C" });
    expect(arr.code).toBe(2);
    expect(arr.stderr).toContain("--input must be a JSON object");
  });
  it("rejects unknown tools, agents and bad --max-timeout", async () => {
    expect((await cli(["run", "--dir", EXAMPLE, "--tool", "frobnicate"], { LANG: "C" })).code).toBe(2);
    expect((await cli(["list", "--dir", EXAMPLE, "--agents", "cursor"], { LANG: "C" })).code).toBe(2);
    expect((await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--max-timeout", "0"], { LANG: "C" })).code).toBe(2);
  });
  it("validates --max-timeout for lint, list and match too", async () => {
    const extra: Record<string, string[]> = { lint: [], list: [], match: ["--tool", "shell"] };
    for (const [cmd, rest] of Object.entries(extra)) {
      for (const bad of ["-1", "abc", "0"]) {
        const r = await cli([cmd, "--dir", EXAMPLE, ...rest, "--max-timeout", bad], { LANG: "C" });
        expect(r.code, `${cmd} ${bad}`).toBe(2);
        expect(r.stderr).toContain("--max-timeout must be a positive number of seconds");
      }
      const ok = await cli([cmd, "--dir", EXAMPLE, ...rest, "--max-timeout", "5"], { LANG: "C" });
      const plain = await cli([cmd, "--dir", EXAMPLE, ...rest], { LANG: "C" });
      expect(ok.code).toBe(plain.code);
      expect(ok.stdout).toBe(plain.stdout);
    }
  });
});
