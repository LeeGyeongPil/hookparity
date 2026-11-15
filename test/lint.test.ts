import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, cliJson, EXAMPLE, FIXTURES } from "./helpers.js";

function ids(data: any): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of data.findings) counts[f.id] = (counts[f.id] ?? 0) + 1;
  return counts;
}

describe("AC-6 lint", () => {
  it("examples/crossagent: HP002 and HP004 reported, HP009 is info, exit 1", async () => {
    const { code, data } = await cliJson(["lint", "--dir", EXAMPLE], { LANG: "C" });
    const found = ids(data);
    expect(code).toBe(1);
    expect(found["HP002"]).toBeGreaterThanOrEqual(1);
    expect(found["HP004"]).toBeGreaterThanOrEqual(1);
    expect(found["HP009"]).toBeGreaterThanOrEqual(1);
    expect(data.findings.filter((f: any) => f.id === "HP009").every((f: any) => f.severity === "info")).toBe(true);
    expect(data.findings.find((f: any) => f.id === "HP002").severity).toBe("warn");
    expect(data.findings.find((f: any) => f.id === "HP004").severity).toBe("error");
  });

  it("HP004 flags claude and gemini mcp matchers, not codex", async () => {
    const { data } = await cliJson(["lint", "--dir", EXAMPLE], { LANG: "C" });
    const agents = data.findings.filter((f: any) => f.id === "HP004").map((f: any) => f.agent).sort();
    expect(agents).toEqual(["claude", "gemini"]);
  });

  it("HP002 explains both directions (ignored `if` and widened scope)", async () => {
    const { data } = await cliJson(["lint", "--dir", EXAMPLE], { LANG: "C" });
    const kinds = data.findings.filter((f: any) => f.id === "HP002").map((f: any) => f.params.kind).sort();
    expect(kinds).toEqual(["ignored", "widened"]);
  });

  it("test/fixtures/broken triggers HP001, HP003, HP005, HP006, HP007, HP008", async () => {
    const { code, data } = await cliJson(["lint", "--dir", join(FIXTURES, "broken")], { LANG: "C" });
    const found = ids(data);
    for (const id of ["HP001", "HP003", "HP005", "HP006", "HP007", "HP008"]) {
      expect(found[id], id).toBeGreaterThanOrEqual(1);
    }
    expect(code).toBe(1);
  });

  it("test/fixtures/clean has no findings and exits 0", async () => {
    const { code, data } = await cliJson(["lint", "--dir", join(FIXTURES, "clean")], { LANG: "C" });
    expect(data.findings).toEqual([]);
    expect(code).toBe(0);
    const text = await cli(["lint", "--dir", join(FIXTURES, "clean")], { LANG: "C" });
    expect(text.stdout.trim()).toBe("No findings.");
  });

  it("--strict turns warnings into exit 1", async () => {
    // HP002 (warn) is the only non-info finding once errors are excluded: use a gemini-only config with `if`
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "hp-strict-"));
    mkdirSync(join(dir, ".gemini"));
    writeFileSync(
      join(dir, ".gemini/settings.json"),
      JSON.stringify({ hooks: { BeforeTool: [{ matcher: "run_shell_command", hooks: [{ type: "command", command: "true", if: "Bash(ls)" }] }] } }),
    );
    expect((await cli(["lint", "--dir", dir], { LANG: "C" })).code).toBe(0);
    expect((await cli(["lint", "--dir", dir, "--strict"], { LANG: "C" })).code).toBe(1);
  });

  it("does not repeat a matcher-level finding for each handler in the same group", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "hp-dedupe-"));
    mkdirSync(join(dir, ".claude"));
    const handlers = [{ type: "command", command: "a" }, { type: "command", command: "b" }];
    writeFileSync(join(dir, ".claude/settings.json"), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash(x)", hooks: handlers }] } }));
    const { data } = await cliJson(["lint", "--dir", dir], { LANG: "C" });
    expect(ids(data)["HP003"]).toBe(1);
  });
});
