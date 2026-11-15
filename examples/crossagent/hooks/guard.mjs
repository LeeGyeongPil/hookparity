// Sample guard hook shared by all agents.
// - `rm -rf` is blocked with exit 2, which every agent understands.
// - `curl` is denied with decision JSON in the Claude Code / Codex shape only,
//   which Gemini CLI does not read (it expects a top-level "decision").
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  const event = JSON.parse(raw || "{}");
  const input = event.tool_input ?? event.toolCall?.args ?? {};
  const command = String(input.command ?? input.CommandLine ?? "");
  if (/rm\s+-rf/.test(command)) {
    process.stderr.write("blocked: rm -rf\n");
    process.exit(2);
  }
  if (/curl/.test(command)) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "network access is not allowed",
        },
      }),
    );
  }
});
