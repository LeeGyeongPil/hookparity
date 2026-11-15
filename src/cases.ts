import { readFileSync } from "node:fs";
import { activeAgents, matchCall } from "./match.js";
import type { MessageKey } from "./i18n/index.js";
import { ALL_AGENTS, ConfigError, DEFAULT_AGENTS, readError, syntaxError, type AgentId, type Decision, type Finding, type HookEntry } from "./model.js";
import { executeMatches } from "./run.js";

export interface Case {
  name: string;
  tool: string;
  input: Record<string, unknown>;
  expect: Record<string, Decision>;
}

export interface Mismatch {
  case: string;
  agent: AgentId;
  expected: Decision;
  /** null when the agent has no counterpart for the tool. */
  got: Decision | null;
  findings: Finding[];
}

export interface CaseResult {
  name: string;
  tool: string;
  checks: { agent: AgentId; expected: Decision; got: Decision | null }[];
  mismatches: Mismatch[];
}

const DECISIONS: readonly string[] = ["block", "allow", "ask"];

/** Parse and validate a cases file. Throws ConfigError (exit 2) with the file and the problem. */
export function loadCases(file: string): Case[] {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    throw readError(file, err);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw syntaxError(file, text, err);
  }
  return validateCases(raw, file);
}

export function validateCases(raw: unknown, file: string): Case[] {
  // 문제 설명은 메시지 키 + 값으로만 만든다(출력 언어는 CLI 가 고른다)
  const bad = (key: MessageKey, params: Record<string, string | number> = {}): never => {
    throw new ConfigError(file, key, params);
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return bad("cases.notObject");
  const list = (raw as { cases?: unknown }).cases;
  if (!Array.isArray(list) || list.length === 0) return bad("cases.empty");
  return list.map((c, i): Case => {
    const at = `cases[${i}]`;
    if (typeof c !== "object" || c === null || Array.isArray(c)) return bad("cases.itemNotObject", { at });
    const o = c as Record<string, unknown>;
    if (typeof o["name"] !== "string" || o["name"] === "") return bad("cases.needString", { field: `${at}.name` });
    if (typeof o["tool"] !== "string" || o["tool"] === "") return bad("cases.needString", { field: `${at}.tool` });
    const input = o["input"] ?? {};
    if (typeof input !== "object" || input === null || Array.isArray(input)) return bad("cases.inputNotObject", { at });
    const expect = o["expect"];
    if (typeof expect !== "object" || expect === null || Array.isArray(expect) || Object.keys(expect).length === 0) {
      return bad("cases.expectMissing", { at });
    }
    const checked: Record<string, Decision> = {};
    for (const [key, value] of Object.entries(expect)) {
      if (key !== "*" && !(ALL_AGENTS as readonly string[]).includes(key)) {
        return bad("cases.unknownAgent", { at, agent: key, allowed: ["*", ...ALL_AGENTS].join(", ") });
      }
      if (typeof value !== "string" || !DECISIONS.includes(value)) {
        // 허용 값은 파일에 그대로 써야 하는 JSON 문자열이라 따옴표째 보여 준다(번역 대상 아님)
        return bad("cases.badDecision", { field: `${at}.expect.${key}`, allowed: DECISIONS.map((d) => `"${d}"`).join(", ") });
      }
      checked[key] = value as Decision;
    }
    return { name: o["name"], tool: o["tool"], input: input as Record<string, unknown>, expect: checked };
  });
}

export interface CaseRunOptions {
  dir: string;
  maxTimeoutSec: number;
  /** --agents; when absent `*` means every detected supported agent. */
  agents?: readonly AgentId[];
}

/** Agents a case is checked on: `*` -> detected (or --agents), plus explicitly named ones. */
export function agentsForCase(c: Case, entries: readonly HookEntry[], selected: readonly AgentId[] | undefined): AgentId[] {
  const explicit = Object.keys(c.expect).filter((k): k is AgentId => k !== "*");
  const wild = "*" in c.expect ? activeAgents(entries, selected, DEFAULT_AGENTS) : [];
  return [...new Set<AgentId>([...wild, ...explicit])].filter((a) => !selected || selected.includes(a) || explicit.includes(a));
}

export async function runCases(cases: readonly Case[], entries: readonly HookEntry[], opts: CaseRunOptions): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of cases) {
    const agents = agentsForCase(c, entries, opts.agents);
    const matches = matchCall(entries, c.tool, c.input, agents);
    const report = await executeMatches(matches, { dir: opts.dir, input: c.input, maxTimeoutSec: opts.maxTimeoutSec });
    const checks: CaseResult["checks"] = [];
    const mismatches: Mismatch[] = [];
    for (const r of report.results) {
      const expected = c.expect[r.agent] ?? c.expect["*"];
      if (expected === undefined) continue;
      const wildOnly = c.expect[r.agent] === undefined;
      if (r.verdict === null && wildOnly) continue; // no counterpart tool: `*` does not demand one
      checks.push({ agent: r.agent, expected, got: r.verdict });
      if (r.verdict !== expected) {
        mismatches.push({ case: c.name, agent: r.agent, expected, got: r.verdict, findings: r.findings });
      }
    }
    results.push({ name: c.name, tool: c.tool, checks, mismatches });
  }
  return results;
}
