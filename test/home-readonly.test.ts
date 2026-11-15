import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, cliJson, FIXTURES, snapshot } from "./helpers.js";

const HOME = join(FIXTURES, "home");
const CLEAN = join(FIXTURES, "clean");

describe("AC-7 antigravity is experimental, home configs are read-only", () => {
  it("--home finds all three Antigravity global candidates, each experimental", async () => {
    const { code, data } = await cliJson(["list", "--dir", CLEAN, "--home", HOME], { LANG: "C" });
    expect(code).toBe(0);
    const ag = data.hooks.filter((h: any) => h.agent === "antigravity");
    expect(ag.map((h: any) => h.source).sort()).toEqual([
      "~/.gemini/antigravity-cli/hooks.json",
      "~/.gemini/antigravity-cli/settings.json",
      "~/.gemini/config/hooks.json",
    ]);
    expect(ag.every((h: any) => h.experimental === true && h.scope === "user")).toBe(true);
    expect(data.hooks.filter((h: any) => h.agent !== "antigravity").every((h: any) => h.experimental === false)).toBe(true);
  });

  it("reads user-level claude, codex (hooks.json + config.toml) and gemini configs too", async () => {
    const { data } = await cliJson(["list", "--dir", CLEAN, "--home", HOME], { LANG: "C" });
    const user = data.hooks.filter((h: any) => h.scope === "user" && h.agent !== "antigravity").map((h: any) => h.source).sort();
    expect(user).toEqual(["~/.claude/settings.json", "~/.codex/config.toml", "~/.codex/hooks.json", "~/.gemini/settings.json"]);
  });

  it("text output marks antigravity as experimental", async () => {
    const r = await cli(["list", "--dir", CLEAN, "--home", HOME], { LANG: "C" });
    expect(r.stdout).toContain("antigravity (experimental)");
    const ko = await cli(["list", "--dir", CLEAN, "--home", HOME, "--lang", "ko"]);
    expect(ko.stdout).toContain("antigravity (실험적)");
  });

  it("antigravity is excluded from the default agents of match and run", async () => {
    const { data } = await cliJson(["match", "--dir", CLEAN, "--home", HOME, "--tool", "shell"], { LANG: "C" });
    expect(data.agents.map((a: any) => a.agent)).toEqual(["claude", "codex", "gemini"]);
    const listed = await cliJson(["match", "--dir", CLEAN, "--home", HOME, "--agents", "antigravity", "--tool", "shell"], { LANG: "C" });
    expect(listed.data.agents[0].hitCount).toBe(3);
  });

  it("content hash and mtime of every home fixture file are unchanged by all commands", async () => {
    const before = snapshot(HOME);
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(7);
    const base = ["--dir", CLEAN, "--home", HOME];
    const cases = join(CLEAN, "..", "..", "..", "examples/crossagent/hookparity.cases.json");
    await cli(["list", ...base], { LANG: "C" });
    await cli(["match", ...base, "--tool", "shell"], { LANG: "C" });
    await cli(["run", ...base, "--agents", "claude,codex,gemini,antigravity", "--tool", "shell"], { LANG: "C" });
    await cli(["test", cases, ...base], { LANG: "C" });
    await cli(["lint", ...base], { LANG: "C" });
    expect(snapshot(HOME)).toEqual(before);
  });

  it("rejects a --home that does not exist", async () => {
    const r = await cli(["list", "--home", "/no/such/home"], { LANG: "C" });
    expect(r.code).toBe(2);
  });

  it("--user reads $HOME (taken from the environment)", async () => {
    const r = await cliJson(["list", "--dir", CLEAN, "--user"], { LANG: "C", HOME });
    expect(r.data.hooks.some((h: any) => h.source === "~/.claude/settings.json")).toBe(true);
  });
});
