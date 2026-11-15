import { AGENTS } from "./agents/index.js";
import { claudeIfApplies } from "./agents/claude.js";
import { ALL_AGENTS, type AgentId, type Finding, type HookEntry, type Severity } from "./model.js";

/** Severity of each static rule. */
export const LINT_SEVERITY: Record<string, Severity> = {
  HP001: "error",
  HP002: "warn",
  HP003: "error",
  HP004: "error",
  HP005: "warn",
  HP006: "error",
  HP007: "error",
  HP008: "error",
  HP009: "info",
};

const PERMISSION_RULE_MATCHER = /^[A-Za-z_]\w*\(.*\)$/s;

/** Static cross-agent checks. Never executes a hook. */
export function lint(entries: readonly HookEntry[]): Finding[] {
  const out: Finding[] = [];
  const seen = new Set<string>();
  const add = (id: string, e: HookEntry, dedupe: string, params: Record<string, string | number> = {}): void => {
    const key = `${id}|${e.agent}|${e.source}|${dedupe}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id, severity: LINT_SEVERITY[id] ?? "info", params: { event: e.event, ...params }, agent: e.agent, source: e.source });
  };

  for (const e of entries) {
    const spec = AGENTS[e.agent];
    const group = `${e.event}#${e.groupIndex}`;
    const matcher = e.matcher;

    // HP006: event name unknown to this agent
    if (!spec.events.includes(e.event)) add("HP006", e, e.event);

    // HP001 / HP002: `if`
    if (e.ifRule !== undefined) {
      if (e.agent === "claude" && !claudeIfApplies(e.event)) {
        add("HP001", e, `${group}|${e.command}`, { rule: e.ifRule });
      }
      if (e.agent !== "claude") {
        add("HP002", e, `${group}|${e.command}`, { kind: "ignored", rule: e.ifRule });
      } else {
        const wider = ALL_AGENTS.filter(
          (a) => a !== "claude" && entries.some((o) => o.agent === a && o.command === e.command && e.command !== undefined && o.ifRule === undefined),
        );
        if (wider.length > 0) add("HP002", e, `${group}|${e.command}`, { kind: "widened", rule: e.ifRule, agents: wider.join(", ") });
      }
    }

    if (matcher !== undefined && matcher !== "" && matcher !== "*") {
      // HP003: permission-rule syntax in a matcher
      if (PERMISSION_RULE_MATCHER.test(matcher)) add("HP003", e, `${group}|${matcher}`, { matcher });

      // HP004: MCP matcher in the wrong form
      if (mcpMatcherBroken(e.agent, matcher)) add("HP004", e, `${group}|${matcher}`, { matcher });

      // HP007: another agent's tool name
      const foreign = foreignTools(e.agent, matcher);
      if (foreign.length > 0) add("HP007", e, `${group}|${matcher}`, { matcher, tools: foreign.join(", ") });

      // HP008: invalid regular expression
      if (spec.matches(matcher, ["x"]).kind === "invalid") add("HP008", e, `${group}|${matcher}`, { matcher });
    }

    // HP005: suspicious timeout unit.
    // Claude Code / Codex read `timeout` in SECONDS, Gemini CLI in MILLISECONDS (research.md, docs/support-matrix.md).
    // `agentUnit` is the unit the agent really uses; the message picks its wording from it.
    if (e.timeoutRaw !== null && e.agent !== "antigravity") {
      const agentUnit = AGENTS[e.agent].timeoutUnit;
      if (agentUnit === "milliseconds" && e.timeoutRaw > 0 && e.timeoutRaw < 1000) {
        // 밀리초로 읽는 에이전트에 5 같은 작은 값: 초로 쓴 실수일 가능성이 높다
        add("HP005", e, `${group}|${e.command}`, { value: e.timeoutRaw, agentUnit, suggest: e.timeoutRaw * 1000 });
      }
      if (agentUnit === "seconds" && e.timeoutRaw > 3600) {
        // 초로 읽는 에이전트에 5000 같은 큰 값: 밀리초로 쓴 실수일 가능성이 높다
        add("HP005", e, `${group}|${e.command}`, { value: e.timeoutRaw, agentUnit, suggest: Math.max(1, Math.round(e.timeoutRaw / 1000)) });
      }
    }

    // HP009: Codex project hooks need trust
    if (e.agent === "codex" && e.scope === "project") add("HP009", e, "trust", {});
  }
  return out;
}

function mcpMatcherBroken(agent: AgentId, matcher: string): boolean {
  if (agent === "gemini") return matcher.includes("mcp__"); // Gemini names are mcp_<server>_<tool>
  if (agent === "claude" && /^[A-Za-z0-9_\- ,|]+$/.test(matcher)) {
    // Exact name list: a bare `mcp__server` can never equal `mcp__server__tool`.
    return matcher.split(/[|,]/).some((t) => /^mcp__[^_]+$/.test(t.trim()));
  }
  return false;
}

function foreignTools(agent: AgentId, matcher: string): string[] {
  const own = new Set(AGENTS[agent].toolNames);
  const tokens = matcher.split(/[^A-Za-z0-9_-]+/).filter(Boolean);
  const others = new Set<string>();
  for (const a of ALL_AGENTS) if (a !== agent) for (const n of AGENTS[a].toolNames) others.add(n);
  return [...new Set(tokens.filter((t) => others.has(t) && !own.has(t)))];
}

export function hasErrors(findings: readonly Finding[], strict: boolean): boolean {
  return findings.some((f) => f.severity === "error" || (strict && f.severity === "warn"));
}
