import { asObject, decideWith, finding, regexMatcher, str } from "./common.js";
import type { AgentSpec } from "./types.js";

// Rules reproduced from https://learn.chatgpt.com/docs/hooks (formerly developers.openai.com/codex/hooks),
// checked 2026-11-15. Exit codes other than 0 and 2 are not documented for Codex.

export const codex: AgentSpec = {
  id: "codex",
  experimental: false,
  preToolEvent: "PreToolUse",
  events: ["SessionStart", "PreToolUse", "PermissionRequest", "PostToolUse", "UserPromptSubmit", "Stop", "PreCompact", "PostCompact"],
  toolNames: ["Bash", "apply_patch", "Edit", "Write"],
  defaultTimeoutSec: 600,
  // Codex 의 timeout 숫자는 초(기본 600)
  timeoutUnit: "seconds",
  projectFiles: [".codex/hooks.json", ".codex/config.toml"],
  userFiles: [".codex/hooks.json", ".codex/config.toml"],
  matches: regexMatcher, // unanchored regex, no exact-list shortcut
  fixture: ({ toolName, toolInput, cwd }) => ({
    session_id: "hookparity-session",
    transcript_path: null,
    cwd,
    hook_event_name: "PreToolUse",
    model: "hookparity-model",
    permission_mode: "default",
    turn_id: "turn_hookparity",
    tool_name: toolName,
    tool_use_id: "call_hookparity",
    tool_input: toolInput,
  }),
  env: () => ({}),
  decide(run, entry) {
    return decideWith(
      {
        fromJson(json, e, findings) {
          const specific = asObject(json["hookSpecificOutput"]);
          const pd = str(specific?.["permissionDecision"]);
          if (pd) {
            const reason = str(specific?.["permissionDecisionReason"]);
            if (pd === "deny") return { decision: "block", reason };
            if (pd === "ask") {
              // Codex does not support ask: the hook is treated as failed and the tool proceeds.
              findings.push(finding("HP103", "warn", e));
              return { decision: "allow", reason };
            }
            return { decision: "allow", reason };
          }
          const legacy = str(json["decision"]);
          if (legacy === "block") return { decision: "block", reason: str(json["reason"]) };
          if (legacy !== undefined && legacy !== "approve") {
            findings.push(finding("HP101", "warn", e, { read: "hookSpecificOutput.permissionDecision", found: `decision:${legacy}` }));
          }
          return undefined;
        },
      },
      run,
      entry,
    );
  },
};

/** Codex matches Edit and Write matchers against apply_patch calls too. */
export const CODEX_PATCH_NAMES = ["apply_patch", "Edit", "Write"] as const;
