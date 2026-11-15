import { asObject, decideWith, finding, regexMatcher, str } from "./common.js";
import type { AgentSpec } from "./types.js";

// Rules reproduced from https://geminicli.com/docs/hooks/reference/ and the gemini-cli 0.68.0 bundle
// (isBlockingDecision reads only a top-level `decision` of "block" or "deny"), checked 2026-11-15.

export const gemini: AgentSpec = {
  id: "gemini",
  experimental: false,
  preToolEvent: "BeforeTool",
  events: [
    "SessionStart", "SessionEnd", "BeforeAgent", "AfterAgent", "BeforeModel", "AfterModel",
    "BeforeToolSelection", "BeforeTool", "AfterTool", "PreCompress", "Notification",
  ],
  toolNames: [
    "run_shell_command", "replace", "write_file", "read_file", "read_many_files", "glob",
    "grep_search", "list_directory", "web_fetch", "google_web_search", "save_memory",
  ],
  defaultTimeoutSec: 60,
  // Gemini CLI 의 timeout 숫자는 밀리초(기본 60000)
  timeoutUnit: "milliseconds",
  projectFiles: [".gemini/settings.json"],
  userFiles: [".gemini/settings.json"],
  matches: regexMatcher,
  fixture: ({ toolName, toolInput, cwd }) => ({
    session_id: "hookparity-session",
    transcript_path: "/tmp/hookparity-transcript.json",
    cwd,
    hook_event_name: "BeforeTool",
    timestamp: new Date().toISOString(),
    tool_name: toolName,
    tool_input: toolInput,
  }),
  env: (projectDir) => ({ GEMINI_PROJECT_DIR: projectDir, CLAUDE_PROJECT_DIR: projectDir }),
  decide(run, entry) {
    return decideWith(
      {
        fromJson(json, e, findings) {
          const top = str(json["decision"]);
          if (top === "deny" || top === "block") return { decision: "block", reason: str(json["reason"]) };
          if (top === "ask") return { decision: "ask", reason: str(json["reason"]) };
          if (top === undefined) {
            const claudeShape = str(asObject(json["hookSpecificOutput"])?.["permissionDecision"]);
            if (claudeShape) {
              findings.push(finding("HP101", "warn", e, { read: "decision", found: `hookSpecificOutput.permissionDecision:${claudeShape}` }));
            }
          }
          return undefined;
        },
      },
      run,
      entry,
    );
  },
};
