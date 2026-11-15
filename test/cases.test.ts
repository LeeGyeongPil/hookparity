import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateCases } from "../src/cases.js";
import { cli, EXAMPLE, FIXED } from "./helpers.js";

function casesFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "hp-cases-"));
  const file = join(dir, "cases.json");
  writeFileSync(file, content);
  return file;
}

describe("AC-5 test command", () => {
  it("reports the one gemini mismatch on examples/crossagent and exits 1", async () => {
    const file = join(EXAMPLE, "hookparity.cases.json");
    const r = await cli(["test", file, "--dir", EXAMPLE, "--json"], { LANG: "C" });
    expect(r.code).toBe(1);
    const data = JSON.parse(r.stdout);
    expect(data.total).toBe(3);
    expect(data.passed).toBe(2);
    const mismatches = data.files[0].cases.flatMap((c: any) => c.mismatches);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ case: "curl is denied", agent: "gemini", expected: "block", got: "allow" });
    expect(mismatches[0].findings.map((f: any) => f.id)).toContain("HP101");
  });

  it("prints a readable CI summary", async () => {
    const r = await cli(["test", join(EXAMPLE, "hookparity.cases.json"), "--dir", EXAMPLE], { LANG: "C" });
    expect(r.stdout).toContain("FAIL  curl is denied");
    expect(r.stdout).toContain("gemini: expected block, got allow");
    expect(r.stdout).toContain("2/3 cases passed, 1 mismatch(es).");
  });

  it("passes on examples/fixed and exits 0", async () => {
    const r = await cli(["test", join(FIXED, "hookparity.cases.json"), "--dir", FIXED], { LANG: "C" });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("3/3 cases passed");
  });

  it("exits 2 for an invalid cases schema", async () => {
    const bad = [
      "{}",
      '{"cases":[]}',
      '{"cases":[{"name":"x","tool":"shell","expect":{"*":"maybe"}}]}',
      '{"cases":[{"name":"x","tool":"shell","expect":{"cursor":"block"}}]}',
      '{"cases":[{"tool":"shell","expect":{"*":"block"}}]}',
      "not json",
    ];
    for (const content of bad) {
      const r = await cli(["test", casesFile(content), "--dir", EXAMPLE], { LANG: "C" });
      expect(r.code, content).toBe(2);
      expect(r.stderr).toContain("cases.json");
    }
  });

  it("exits 2 when no cases file is given or the file is missing", async () => {
    expect((await cli(["test", "--dir", EXAMPLE], { LANG: "C" })).code).toBe(2);
    expect((await cli(["test", "/no/such/cases.json", "--dir", EXAMPLE], { LANG: "C" })).code).toBe(2);
  });

  it("`*` expectations skip antigravity unless it is listed", async () => {
    const file = casesFile(JSON.stringify({ cases: [{ name: "ls", tool: "shell", input: { command: "ls" }, expect: { "*": "allow" } }] }));
    const r = await cli(["test", file, "--dir", EXAMPLE, "--json"], { LANG: "C" });
    const agents = JSON.parse(r.stdout).files[0].cases[0].checks.map((c: any) => c.agent);
    expect(agents).toEqual(["claude", "codex", "gemini"]);
    const listed = casesFile(JSON.stringify({ cases: [{ name: "ls", tool: "shell", input: { command: "ls" }, expect: { "*": "allow", antigravity: "allow" } }] }));
    const r2 = await cli(["test", listed, "--dir", EXAMPLE, "--json"], { LANG: "C" });
    expect(JSON.parse(r2.stdout).files[0].cases[0].checks.map((c: any) => c.agent)).toContain("antigravity");
  });

  it("an explicit agent without a counterpart tool is a mismatch, `*` is not", async () => {
    const file = casesFile(JSON.stringify({ cases: [{ name: "read", tool: "read", expect: { "*": "allow", codex: "allow" } }] }));
    const r = await cli(["test", file, "--dir", EXAMPLE, "--json"], { LANG: "C" });
    expect(r.code).toBe(1);
    expect(JSON.parse(r.stdout).files[0].cases[0].mismatches[0]).toMatchObject({ agent: "codex", got: null });
  });

  it("validateCases returns normalized cases", () => {
    const [c] = validateCases({ cases: [{ name: "a", tool: "shell", expect: { "*": "block" } }] }, "f.json");
    expect(c).toEqual({ name: "a", tool: "shell", input: {}, expect: { "*": "block" } });
  });
});
