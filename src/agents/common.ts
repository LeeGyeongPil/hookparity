import type { Decision, Finding, HookEntry } from "../model.js";
import type { HookRun } from "../runner.js";
import type { HookVerdict, MatcherResult } from "./types.js";

/** "*", "" and a missing matcher select every tool in all supported agents. */
export function selectsAll(matcher: string | undefined): boolean {
  return matcher === undefined || matcher === "" || matcher === "*";
}

/** Unanchored JavaScript regular expression matched against each candidate tool name. */
export function regexMatcher(matcher: string | undefined, names: readonly string[]): MatcherResult {
  if (selectsAll(matcher)) return { matched: true, kind: "all" };
  let re: RegExp;
  try {
    re = new RegExp(matcher as string);
  } catch {
    return { matched: false, kind: "invalid" };
  }
  return { matched: names.some((n) => re.test(n)), kind: "regex" };
}

export function finding(
  id: string,
  severity: Finding["severity"],
  entry: HookEntry,
  params: Record<string, string | number> = {},
): Finding {
  return { id, severity, params, agent: entry.agent, source: entry.source };
}

export type JsonObject = Record<string, unknown>;

export function asObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export interface ParsedStdout {
  kind: "empty" | "json" | "invalid";
  json?: JsonObject;
}

export function parseStdout(stdout: string): ParsedStdout {
  const text = stdout.trim();
  if (text === "") return { kind: "empty" };
  try {
    const parsed: unknown = JSON.parse(text);
    const obj = asObject(parsed);
    return obj ? { kind: "json", json: obj } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

export interface DecideRules {
  /** Claude Code: a timeout blocks only when the handler says `onFailure: "block"`. */
  timeoutBlocks?(entry: HookEntry): boolean;
  /** Read a decision out of stdout JSON. Return undefined when nothing was decided. */
  fromJson(json: JsonObject, entry: HookEntry, findings: Finding[]): { decision: Decision; reason: string | undefined } | undefined;
}

/**
 * Shared skeleton for the exit-code rules:
 *   timeout        -> HP104 (blocks only where the agent says so)
 *   exit 2         -> block
 *   other non-zero -> allow + HP102
 *   exit 0         -> stdout JSON decides
 */
export function decideWith(rules: DecideRules, run: HookRun, entry: HookEntry): HookVerdict {
  const findings: Finding[] = [];
  const reasonFromStderr = run.stderr.trim() || undefined;

  if (run.timedOut) {
    const blocks = rules.timeoutBlocks?.(entry) ?? false;
    findings.push(
      finding("HP104", "warn", entry, {
        sec: run.timeoutSec,
        outcome: blocks ? "block" : "allow",
      }),
    );
    return { decision: blocks ? "block" : "allow", reason: undefined, findings };
  }
  if (run.code === 2) {
    return { decision: "block", reason: reasonFromStderr, findings };
  }
  if (run.code !== 0) {
    // 신호로 끝난 경우(code 가 null)는 낱말 "signal" 대신 신호 이름을 넘기고 문구 변형(HP102.signal)을 쓴다
    findings.push(finding("HP102", "warn", entry, run.code === null ? { signal: run.signal ?? "?" } : { code: run.code }));
    return { decision: "allow", reason: reasonFromStderr, findings };
  }

  const out = parseStdout(run.stdout);
  if (out.kind === "invalid") {
    findings.push(finding("HP105", "warn", entry, { sample: run.stdout.trim().slice(0, 40) }));
    return { decision: "allow", reason: undefined, findings };
  }
  if (out.kind === "empty" || !out.json) return { decision: "allow", reason: undefined, findings };

  const decided = rules.fromJson(out.json, entry, findings);
  return { decision: decided?.decision ?? "allow", reason: decided?.reason, findings };
}
