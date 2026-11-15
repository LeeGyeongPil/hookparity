import { AGENTS } from "./agents/index.js";
import { claudeIfApplies } from "./agents/claude.js";
import type { MatchKind } from "./agents/types.js";
import type { AgentId, HookEntry } from "./model.js";
import { evalIfRule } from "./permissionRule.js";
import { resolveTool } from "./tools.js";

/** How a Claude `if` filter came out for one call. */
export type IfResult = "none" | "true" | "false" | "ignored" | "never-runs";

export interface Hit {
  entry: HookEntry;
  matchKind: MatchKind;
  ifResult: IfResult;
  /** False for handler types hookparity does not execute (http, prompt, ...). */
  runnable: boolean;
}

export interface AgentMatch {
  agent: AgentId;
  /** Tool name written into the fixture; null when the agent has no counterpart tool. */
  toolName: string | null;
  /** Names the matchers are tested against. */
  names: string[];
  /** Hooks that fire for this call. */
  hits: Hit[];
  /** Matcher matched but the Claude `if` filter said no. */
  filtered: Hit[];
}

/** Which agents take part when --agents is not given: the three supported ones that have a config. */
export function activeAgents(entries: readonly HookEntry[], selected: readonly AgentId[] | undefined, defaults: readonly AgentId[]): AgentId[] {
  if (selected) return [...selected];
  return defaults.filter((a) => entries.some((e) => e.agent === a));
}

/** Decide which hooks fire for one virtual tool call. Never executes anything. */
export function matchCall(
  entries: readonly HookEntry[],
  toolSpec: string,
  input: Record<string, unknown>,
  agents: readonly AgentId[],
): AgentMatch[] {
  const resolved = resolveTool(toolSpec);
  return agents.map((agent): AgentMatch => {
    const names = resolved[agent];
    if (!names || names.length === 0) return { agent, toolName: null, names: [], hits: [], filtered: [] };
    const spec = AGENTS[agent];
    const hits: Hit[] = [];
    const filtered: Hit[] = [];
    for (const entry of entries) {
      if (entry.agent !== agent || entry.event !== spec.preToolEvent) continue;
      const m = spec.matches(entry.matcher, names);
      if (!m.matched) continue;
      const ifResult = evaluateIf(entry, names[0] as string, input);
      const hit: Hit = { entry, matchKind: m.kind, ifResult, runnable: entry.type === "command" && entry.command !== undefined };
      (ifResult === "false" || ifResult === "never-runs" ? filtered : hits).push(hit);
    }
    return { agent, toolName: names[0] as string, names, hits, filtered };
  });
}

/** `if` exists only in Claude Code; other agents ignore the field. */
export function evaluateIf(entry: HookEntry, toolName: string, input: Record<string, unknown>): IfResult {
  if (entry.ifRule === undefined) return "none";
  if (entry.agent !== "claude") return "ignored";
  if (!claudeIfApplies(entry.event)) return "never-runs";
  return evalIfRule(entry.ifRule, toolName, input) ? "true" : "false";
}
