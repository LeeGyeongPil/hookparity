# Support matrix

hookparity reproduces agent behavior from official documentation. It does not launch any agent, so
results can differ from a real session. Facts below were checked on 2026-11-15.

| Agent | Version basis | Pre-tool event | Config files read | Timeout unit |
|---|---|---|---|---|
| Claude Code | docs for 2.1.325 | `PreToolUse` | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` | seconds (default 600) |
| Codex CLI | codex-cli 0.169.0 | `PreToolUse` | `.codex/hooks.json`, `.codex/config.toml` (`[[hooks.<Event>]]`), same under `~/` | seconds (default 600) |
| Gemini CLI | gemini-cli 0.68.0 | `BeforeTool` | `.gemini/settings.json`, `~/.gemini/settings.json` | milliseconds (default 60000) |
| Antigravity CLI | experimental | `PreToolUse` | `.agents/hooks.json`, `~/.gemini/config/hooks.json`, `~/.gemini/antigravity-cli/settings.json`, `~/.gemini/antigravity-cli/hooks.json` | seconds (default 30, undocumented) |

## Rules reproduced

| Topic | Claude Code | Codex CLI | Gemini CLI | Antigravity CLI |
|---|---|---|---|---|
| Matcher | letters, digits, `_`, `-`, space, `,`, `\|` only: exact name list; otherwise unanchored regex | unanchored regex | unanchored regex | unanchored regex |
| `*`, empty, missing matcher | all tools | all tools | all tools | all tools |
| MCP tool name | `mcp__<server>__<tool>` | `mcp__<server>__<tool>` | `mcp_<server>_<tool>` | not modeled |
| Shell / edit tool names | `Bash`, `Edit`, `Write`, `Read` | `Bash`, `apply_patch` (also matched by `Edit` and `Write`) | `run_shell_command`, `replace`, `write_file`, `read_file` | `run_command`, `view_file` |
| `if` filter | permission rule, evaluated on tool events only | not supported (ignored) | not supported (ignored) | not supported (ignored) |
| Block signal | exit 2, or `hookSpecificOutput.permissionDecision: "deny"` | exit 2, or `hookSpecificOutput.permissionDecision: "deny"` | exit 2, or top-level `decision: "deny" \| "block"` | exit 2 (assumed), or top-level `decision: "deny"` |
| Other non-zero exit | not a block | not a block (undocumented) | not a block | not a block (undocumented) |
| Timeout on a pre-tool hook | proceeds; blocks only with `onFailure: "block"` | proceeds | proceeds with a warning | proceeds |
| `ask` | supported | not supported: hook counts as failed, call proceeds | supported | supported |

## Sources

- https://code.claude.com/docs/en/hooks
- https://learn.chatgpt.com/docs/hooks (formerly https://developers.openai.com/codex/hooks)
- https://geminicli.com/docs/hooks/reference/
- https://antigravity.google/docs/hooks.md
- gemini-cli 0.68.0 npm bundle: `isBlockingDecision` reads only a top-level `decision` of `block` or `deny`,
  and `gemini hooks migrate --from-claude` drops `if` and leaves `mcp__<server>` matchers unchanged.

Antigravity documentation sources disagree about the global config location, so all three candidates are
read and every result is labeled experimental.
