import { AGENTS } from "./agents/index.js";
import type { AgentMatch, Hit } from "./match.js";
import type { AgentId, Decision, Finding } from "./model.js";
import { runHook, type HookRun } from "./runner.js";

export interface HookOutcome {
  hit: Hit;
  /** Undefined when the handler type is not executed. */
  run: HookRun | undefined;
  decision: Decision;
  reason: string | undefined;
  findings: Finding[];
}

export interface AgentResult {
  agent: AgentId;
  toolName: string | null;
  /** Final decision for this agent; null when the agent has no counterpart tool. */
  verdict: Decision | null;
  reason: string | undefined;
  hooks: HookOutcome[];
  findings: Finding[];
}

export interface RunReport {
  results: AgentResult[];
  verdicts: Partial<Record<AgentId, Decision>>;
  /** True when the agents that were evaluated do not all reach the same decision. */
  divergent: boolean;
}

export interface ExecuteOptions {
  dir: string;
  input: Record<string, unknown>;
  maxTimeoutSec: number;
}

const RANK: Record<Decision, number> = { allow: 0, ask: 1, block: 2 };

/** Run the matched hooks of every agent (agents and hooks in parallel, results in config order). */
export async function executeMatches(matches: readonly AgentMatch[], opts: ExecuteOptions): Promise<RunReport> {
  const results = await Promise.all(matches.map((m) => executeAgent(m, opts)));
  const verdicts: Partial<Record<AgentId, Decision>> = {};
  for (const r of results) if (r.verdict !== null) verdicts[r.agent] = r.verdict;
  const distinct = new Set(Object.values(verdicts));
  return { results, verdicts, divergent: distinct.size > 1 };
}

async function executeAgent(match: AgentMatch, opts: ExecuteOptions): Promise<AgentResult> {
  const spec = AGENTS[match.agent];
  if (match.toolName === null) {
    return { agent: match.agent, toolName: null, verdict: null, reason: undefined, hooks: [], findings: [] };
  }
  const stdin = spec.fixture({ toolName: match.toolName, toolInput: opts.input, cwd: opts.dir });
  // Matching hooks run concurrently (like real agents); Promise.all keeps the output order stable.
  const hooks: HookOutcome[] = await Promise.all(match.hits.map((hit) => executeHook(hit, spec, stdin, opts)));


  let decision: Decision = "allow";
  let reason: string | undefined;
  for (const h of hooks) {
    if (RANK[h.decision] > RANK[decision]) {
      decision = h.decision;
      reason = h.reason;
    }
  }
  return {
    agent: match.agent,
    toolName: match.toolName,
    verdict: decision,
    reason,
    hooks,
    findings: hooks.flatMap((h) => h.findings),
  };
}

async function executeHook(hit: Hit, spec: (typeof AGENTS)[AgentId], stdin: Record<string, unknown>, opts: ExecuteOptions): Promise<HookOutcome> {
  if (!hit.runnable || hit.entry.command === undefined) {
    return { hit, run: undefined, decision: "allow", reason: undefined, findings: [] };
  }
  const configured = hit.entry.timeoutSec ?? spec.defaultTimeoutSec;
  const timeoutSec = Math.min(configured, opts.maxTimeoutSec);
  const run = await runHook(hit.entry.command, stdin, {
    cwd: opts.dir,
    env: spec.env(opts.dir),
    timeoutSec,
    capped: configured > opts.maxTimeoutSec,
  });
  const verdict = spec.decide(run, hit.entry);
  return { hit, run, decision: verdict.decision, reason: verdict.reason, findings: verdict.findings };
}
