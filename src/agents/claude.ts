import { asObject, decideWith, finding, selectsAll, str } from "./common.js";
import type { AgentSpec, MatcherResult } from "./types.js";

// Rules reproduced from https://code.claude.com/docs/en/hooks (checked 2026-11-15).

const EVENTS = [
  "SessionStart", "Setup", "UserPromptSubmit", "UserPromptExpansion", "PreToolUse", "PermissionRequest",
  "PermissionDenied", "PostToolUse", "PostToolUseFailure", "PostToolBatch", "Notification",
  "SubagentStart", "SubagentStop", "TaskCreated", "TaskCompleted", "Stop", "StopFailure", "TeammateIdle",
  "InstructionsLoaded", "ConfigChange", "CwdChanged", "FileChanged", "WorktreeCreate", "WorktreeRemove",
  "PreCompact", "PostCompact", "Elicitation", "ElicitationResult", "SessionEnd",
] as const;

/** Events where the `if` filter is evaluated. On any other event a handler with `if` never runs. */
export const CLAUDE_IF_EVENTS: readonly string[] = [
  "PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest", "PermissionDenied",
];

export function claudeIfApplies(event: string): boolean {
  return CLAUDE_IF_EVENTS.includes(event);
}

/** Only letters, digits, `_`, `-`, space, `,` and `|` make the matcher an exact name list. */
const EXACT_LIST = /^[A-Za-z0-9_\- ,|]+$/;

export function claudeMatches(matcher: string | undefined, names: readonly string[]): MatcherResult {
  if (selectsAll(matcher)) return { matched: true, kind: "all" };
  const m = matcher as string;
  if (EXACT_LIST.test(m)) {
    const wanted = m.split(/[|,]/).map((s) => s.trim()).filter(Boolean);
    return { matched: names.some((n) => wanted.includes(n)), kind: "exact" };
  }
  try {
    const re = new RegExp(m);
    return { matched: names.some((n) => re.test(n)), kind: "regex" };
  } catch {
    return { matched: false, kind: "invalid" };
  }
}

export const claude: AgentSpec = {
  id: "claude",
  experimental: false,
  preToolEvent: "PreToolUse",
  events: EVENTS,
  toolNames: ["Bash", "Edit", "Write", "Read", "Glob", "Grep", "NotebookEdit", "WebFetch", "WebSearch", "Task", "TodoWrite"],
  defaultTimeoutSec: 600,
  // Claude Code 의 timeout 숫자는 초(기본 600)
  timeoutUnit: "seconds",
  projectFiles: [".claude/settings.json", ".claude/settings.local.json"],
  userFiles: [".claude/settings.json"],
  matches: claudeMatches,
  fixture: ({ toolName, toolInput, cwd }) => ({
    session_id: "hookparity-session",
    transcript_path: "/tmp/hookparity-transcript.jsonl",
    cwd,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "toolu_hookparity",
  }),
  env: (projectDir) => ({ CLAUDE_PROJECT_DIR: projectDir }),
  decide(run, entry) {
    return decideWith(
      {
        // A PreToolUse timeout does not block unless the handler asks for it.
        timeoutBlocks: (e) => e.onFailure === "block",
        fromJson(json, e, findings) {
          const specific = asObject(json["hookSpecificOutput"]);
          const pd = str(specific?.["permissionDecision"]);
          if (pd) {
            const reason = str(specific?.["permissionDecisionReason"]);
            if (pd === "deny") return { decision: "block", reason };
            if (pd === "ask") return { decision: "ask", reason };
            return { decision: "allow", reason }; // allow | defer
          }
          // Deprecated top-level form still accepted by Claude Code.
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
