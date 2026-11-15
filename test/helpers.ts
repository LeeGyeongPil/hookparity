import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { run, type Context } from "../src/app.js";
import { AGENTS } from "../src/agents/index.js";
import type { AgentId, Decision, HookEntry } from "../src/model.js";
import { matchCall } from "../src/match.js";
import { executeMatches, type RunReport } from "../src/run.js";

export const ROOT = resolve(import.meta.dirname, "..");
export const EXAMPLE = join(ROOT, "examples/crossagent");
export const FIXED = join(ROOT, "examples/fixed");
export const FIXTURES = join(ROOT, "test/fixtures");

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the CLI in-process with a controlled environment (no inherited LANG etc.). */
export async function cli(args: string[], env: Record<string, string> = {}, cwd: string = ROOT): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  const ctx: Context = {
    env,
    cwd,
    stdout: (s) => void (stdout += s),
    stderr: (s) => void (stderr += s),
    isTTY: false,
  };
  const code = await run(args, ctx);
  return { code, stdout, stderr };
}

export async function cliJson<T = any>(args: string[], env: Record<string, string> = {}): Promise<{ code: number; data: T }> {
  const r = await cli([...args, "--json"], env);
  return { code: r.code, data: JSON.parse(r.stdout) as T };
}

/** Build a hook entry for direct verdict tests. */
export function entry(agent: AgentId, command: string, extra: Partial<HookEntry> = {}): HookEntry {
  return {
    agent,
    event: AGENTS[agent].preToolEvent,
    matcher: undefined,
    type: "command",
    command,
    ifRule: undefined,
    timeoutSec: null,
    timeoutRaw: null,
    onFailure: undefined,
    source: "test",
    file: "test",
    scope: "project",
    experimental: AGENTS[agent].experimental,
    groupIndex: 0,
    ...extra,
  };
}

/** Run one hook command under one agent's rules and return that agent's result. */
export async function runOne(
  agent: AgentId,
  command: string,
  extra: Partial<HookEntry> = {},
  opts: { maxTimeoutSec?: number; dir?: string } = {},
): Promise<{ verdict: Decision | null; ids: string[]; report: RunReport; ms: number }> {
  const entries = [entry(agent, command, extra)];
  const matches = matchCall(entries, "shell", { command: "ls" }, [agent]);
  const started = Date.now();
  const report = await executeMatches(matches, { dir: opts.dir ?? ROOT, input: { command: "ls" }, maxTimeoutSec: opts.maxTimeoutSec ?? 30 });
  const result = report.results[0];
  return { verdict: result?.verdict ?? null, ids: (result?.findings ?? []).map((f) => f.id), report, ms: Date.now() - started };
}

/** Content hash and mtime of every file below a directory. */
export function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out[p] = `${createHash("sha256").update(readFileSync(p)).digest("hex")}@${st.mtimeMs}`;
    }
  };
  walk(dir);
  return out;
}
