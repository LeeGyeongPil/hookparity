import type { AgentId } from "../model.js";
import { antigravity } from "./antigravity.js";
import { claude } from "./claude.js";
import { codex } from "./codex.js";
import { gemini } from "./gemini.js";
import type { AgentSpec } from "./types.js";

export const AGENTS: Record<AgentId, AgentSpec> = { claude, codex, gemini, antigravity };

export function agentSpec(id: AgentId): AgentSpec {
  return AGENTS[id];
}

export type { AgentSpec } from "./types.js";
