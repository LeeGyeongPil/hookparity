import type { AgentId, Decision, Finding, HookEntry } from "../model.js";
import type { HookRun } from "../runner.js";

export type MatchKind = "all" | "exact" | "regex" | "invalid";

export interface MatcherResult {
  matched: boolean;
  kind: MatchKind;
}

/** What one hook run means for an agent. */
export interface HookVerdict {
  decision: Decision;
  reason: string | undefined;
  findings: Finding[];
}

export interface FixtureContext {
  toolName: string;
  toolInput: Record<string, unknown>;
  cwd: string;
}

/** Everything that differs between agents, in one place. */
export interface AgentSpec {
  id: AgentId;
  experimental: boolean;
  /** Event that fires before a tool runs. */
  preToolEvent: string;
  /** Every event name this agent documents (for HP006). */
  events: readonly string[];
  /** Tool names this agent has (for HP007). */
  toolNames: readonly string[];
  /** Default hook timeout in seconds when the config sets none. */
  defaultTimeoutSec: number;
  /** Unit of the `timeout` number in this agent's config: Claude Code / Codex seconds, Gemini CLI milliseconds. */
  timeoutUnit: "seconds" | "milliseconds";
  /** Config files relative to a project directory. */
  projectFiles: readonly string[];
  /** Config files relative to the user's home directory. */
  userFiles: readonly string[];
  /** Does this agent's matcher string select a tool with one of these names? */
  matches(matcher: string | undefined, names: readonly string[]): MatcherResult;
  /** stdin JSON for a pre-tool event. */
  fixture(ctx: FixtureContext): Record<string, unknown>;
  /** Extra environment variables the agent sets for hooks. */
  env(projectDir: string): Record<string, string>;
  /** Turn one hook run into a decision. */
  decide(run: HookRun, entry: HookEntry): HookVerdict;
}
