import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, EXAMPLE, ROOT } from "./helpers.js";

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string; bin: Record<string, string> };

describe("AC-9 built CLI (dist/cli.js)", () => {
  const node = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [join(ROOT, "dist/cli.js"), ...args], {
      cwd: ROOT,
      env: { PATH: process.env["PATH"] ?? "", ...env },
      encoding: "utf8",
    });

  it("--version prints the package.json version", () => {
    const r = node(["--version"]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(pkg.version);
  });

  it("package bin points at the built file", () => {
    expect(pkg.bin["hookparity"]).toBe("dist/cli.js");
    expect(readFileSync(join(ROOT, "dist/cli.js"), "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("the start command output shows the crossagent divergence with gemini highlighted", () => {
    const r = node(["run", "--dir", "examples/crossagent", "--tool", "shell", "--input", '{"command":"curl https://example.com"}', "--lang", "en"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/gemini\s+run_shell_command\s+allow\s+<--/);
    expect(r.stdout).toMatch(/claude\s+Bash\s+block\s+1/);
    expect(r.stdout).toContain("Agents disagree: claude=block, codex=block, gemini=allow");
  });

  it("--lang ko help from the built CLI", () => {
    const r = node(["--help", "--lang", "ko"]);
    expect(r.stdout).toContain("사용법:");
  });

  it("NO_COLOR and non-TTY output contain no escape codes", () => {
    const r = node(["lint", "--dir", "examples/crossagent"], { NO_COLOR: "1" });
    expect(r.stdout).not.toContain("\u001b[");
  });
});

describe("CLI usage", () => {
  it("prints help on --help and for the help command", async () => {
    const a = await cli(["--help"], {});
    const b = await cli(["help"], {});
    expect(a.stdout).toBe(b.stdout);
    expect(a.stdout).toContain("hookparity list");
    expect(a.stdout).toContain(pkg.version);
  });

  it("exits 2 with a hint for an unknown command or option", async () => {
    const cmd = await cli(["explode"], {});
    expect(cmd.code).toBe(2);
    expect(cmd.stderr).toContain('Unknown command "explode"');
    const opt = await cli(["list", "--bogus"], {});
    expect(opt.code).toBe(2);
    expect(opt.stderr).toContain("--help");
  });

  it("prints help to stderr and exits 2 when no command is given", async () => {
    const r = await cli([], {});
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage:");
  });

  it("list reports an empty directory without failing", async () => {
    const r = await cli(["list", "--dir", join(ROOT, "docs")], { LANG: "C" });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("No hooks found");
  });

  it("list --agents filters by agent", async () => {
    const r = await cli(["list", "--dir", EXAMPLE, "--agents", "gemini", "--json"], {});
    const hooks = JSON.parse(r.stdout).hooks as { agent: string }[];
    expect(new Set(hooks.map((h) => h.agent))).toEqual(new Set(["gemini"]));
  });
});
