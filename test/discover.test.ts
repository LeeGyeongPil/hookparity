import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discover } from "../src/discover.js";
import { ConfigError } from "../src/model.js";
import { cli, cliJson, EXAMPLE, FIXTURES } from "./helpers.js";

describe("AC-1 list / discovery", () => {
  it("finds claude, codex (hooks.json and config.toml) and gemini hooks with source paths", async () => {
    const { code, data } = await cliJson(["list", "--dir", EXAMPLE], { LANG: "C" });
    expect(code).toBe(0);
    const hooks = data.hooks as { agent: string; source: string; event: string; command: string }[];
    const sources = new Set(hooks.map((h) => `${h.agent}:${h.source}`));
    expect(sources).toContain("claude:.claude/settings.json");
    expect(sources).toContain("codex:.codex/hooks.json");
    expect(sources).toContain("codex:.codex/config.toml");
    expect(sources).toContain("gemini:.gemini/settings.json");
    const toml = hooks.find((h) => h.source === ".codex/config.toml");
    expect(toml?.event).toBe("PreToolUse");
    expect(toml?.command).toBe("true");
  });

  it("normalizes timeouts to seconds (gemini 5000 ms -> 5 s)", async () => {
    const { data } = await cliJson(["list", "--dir", EXAMPLE, "--agents", "gemini"], { LANG: "C" });
    const guard = data.hooks.find((h: any) => h.command === "node hooks/guard.mjs" && h.timeoutRaw !== null);
    expect(guard.timeoutRaw).toBe(5000);
    expect(guard.timeoutSec).toBe(5);
    const claude = (await cliJson(["list", "--dir", EXAMPLE, "--agents", "claude"], { LANG: "C" })).data.hooks.find((h: any) => h.timeoutRaw === 5);
    expect(claude.timeoutSec).toBe(5);
  });

  it("keeps the Claude if rule and tolerates handlers without a timeout", () => {
    const entries = discover({ dir: EXAMPLE, agents: ["claude"] });
    expect(entries.find((e) => e.ifRule === "Bash(git push*)")?.timeoutSec).toBe(1);
    expect(entries.find((e) => e.event === "PostToolUse")?.timeoutSec).toBeNull();
  });

  it("exits 2 and names the file for malformed JSON", async () => {
    const r = await cli(["list", "--dir", join(FIXTURES, "malformed")], { LANG: "C" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(join("malformed", ".claude", "settings.json"));
  });

  it("exits 2 and names the file and line for malformed TOML", async () => {
    const r = await cli(["list", "--dir", join(FIXTURES, "malformed-toml")], { LANG: "C" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("config.toml");
    expect(r.stderr).toMatch(/line \d+/);
  });

  it("throws ConfigError from the library API", () => {
    expect(() => discover({ dir: join(FIXTURES, "malformed") })).toThrow(ConfigError);
  });

  it("rejects a config whose top level is not an object", () => {
    const dir = mkdtempSync(join(tmpdir(), "hp-top-"));
    mkdirSync(join(dir, ".gemini"));
    writeFileSync(join(dir, ".gemini/settings.json"), "[1,2]");
    expect(() => discover({ dir })).toThrow(/top level must be an object/);
  });

  it("reports a missing --dir as a usage error", async () => {
    const r = await cli(["list", "--dir", "/nonexistent/hookparity-dir"], { LANG: "C" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Directory not found");
  });
});
