import { asObject, decideWith, finding, regexMatcher, str } from "./common.js";
import type { AgentSpec } from "./types.js";

// EXPERIMENTAL. https://antigravity.google/docs/hooks.md and a community guide disagree on the global
// config location, and exit-code semantics are not documented. Checked 2026-11-15.

export const antigravity: AgentSpec = {
  id: "antigravity",
  experimental: true,
  preToolEvent: "PreToolUse",
  events: ["PreToolUse", "PostToolUse", "PreInvocation", "Stop"],
  toolNames: ["run_command", "view_file"],
  defaultTimeoutSec: 30,
  // Antigravity CLI 문서의 기본값 30은 초로 적혀 있다(실험적)
  timeoutUnit: "seconds",
  projectFiles: [".agents/hooks.json"],
  userFiles: [".gemini/config/hooks.json", ".gemini/antigravity-cli/settings.json", ".gemini/antigravity-cli/hooks.json"],
  matches: regexMatcher,
  fixture: ({ toolName, toolInput, cwd }) => ({
    conversationId: "hookparity-conversation",
    cwd,
    eventName: "PreToolUse",
    toolCall: { name: toolName, args: toolInput },
  }),
  env: () => ({}),
  decide(run, entry) {
    return decideWith(
      {
        fromJson(json, e, findings) {
          const top = str(json["decision"]);
          if (top === "deny") return { decision: "block", reason: str(json["reason"]) };
          if (top === "ask") return { decision: "ask", reason: str(json["reason"]) };
          if (top === undefined) {
            const claudeShape = str(asObject(json["hookSpecificOutput"])?.["permissionDecision"]);
            if (claudeShape) {
              findings.push(finding("HP101", "warn", e, { read: "decision", found: `hookSpecificOutput.permissionDecision:${claudeShape}` }));
            }
          }
          return undefined; // allow / auto_approve / anything else proceeds
        },
      },
      run,
      entry,
    );
  },
};
