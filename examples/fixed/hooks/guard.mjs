// Fixed guard hook: the same deny decision is written in both shapes, so every agent reads it.
// - hookSpecificOutput.permissionDecision is read by Claude Code and Codex CLI.
// - a top-level "decision" is read by Gemini CLI.
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
    const reason = "network access is not allowed";
    process.stdout.write(
      JSON.stringify({
        decision: "deny",
        reason,
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
      }),
    );
  }
});
