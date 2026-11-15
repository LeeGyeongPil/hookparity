import { ALL_AGENTS, UsageError, type AgentId } from "./model.js";

/**
 * Candidate tool names per agent for one virtual tool call. The first name is
 * the one written into the stdin fixture; every name is tried against matchers.
 */
export type ResolvedTool = Partial<Record<AgentId, string[]>>;

const MCP_CLAUDE_NAME = /^mcp__([^_][^]*?)__(.+)$/;

/** Turn `--tool` into per-agent tool names. Throws UsageError for unknown specs. */
export function resolveTool(spec: string): ResolvedTool {
  const direct = /^([a-z]+):(.+)$/.exec(spec);
  if (direct && (ALL_AGENTS as readonly string[]).includes(direct[1] as string)) {
    return { [direct[1] as AgentId]: [direct[2] as string] };
  }

  const mcp = /^mcp:([^/]+)\/(.+)$/.exec(spec) ?? MCP_CLAUDE_NAME.exec(spec);
  if (mcp) return mcpTool(mcp[1] as string, mcp[2] as string);

  const patch = ["apply_patch", "Edit", "Write"];
  switch (spec) {
    case "shell":
    case "bash":
    case "Bash":
      return { claude: ["Bash"], codex: ["Bash"], gemini: ["run_shell_command"], antigravity: ["run_command"] };
    case "edit":
    case "Edit":
      return { claude: ["Edit"], codex: patch, gemini: ["replace"] };
    case "write":
    case "Write":
      return { claude: ["Write"], codex: patch, gemini: ["write_file"] };
    case "read":
    case "Read":
      return { claude: ["Read"], gemini: ["read_file"], antigravity: ["view_file"] };
    default:
      throw new UsageError("error.unknownTool", { tool: spec });
  }
}

function mcpTool(server: string, tool: string): ResolvedTool {
  return {
    claude: [`mcp__${server}__${tool}`],
    codex: [`mcp__${server}__${tool}`],
    gemini: [`mcp_${server}_${tool}`],
  };
}
