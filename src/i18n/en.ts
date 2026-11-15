// English messages. ko.ts must define exactly the same keys.
export const en = {
  "help.text": `hookparity {version} - preview, run, test and lint agent hooks side by side

Usage:
  hookparity list  [--dir .] [--user | --home <dir>] [--agents claude,codex,gemini,antigravity] [--json]
  hookparity match --tool <tool> [--input '<json>'] [--dir .] [--json]
  hookparity run   --tool <tool> [--input '<json>'] [--dir .] [--max-timeout 30] [--fail-on-divergence] [--json]
  hookparity test  <cases.json...> [--dir .] [--max-timeout 30] [--json]
  hookparity lint  [--dir .] [--strict] [--json]

Commands:
  list    Show every hook found in project (and user) configs, timeouts in seconds.
  match   Show which hooks fire for one virtual tool call. Runs nothing.
  run     Run the matching hooks with each agent's stdin and compare the verdicts.
  test    Check expectations from a cases file (CI regression). Exit 1 on mismatch.
  lint    Static cross-agent checks (HP001-HP009). Runs nothing.

Tools: shell, edit, write, read, mcp:<server>/<tool>, Claude names (Bash, Edit, mcp__s__t),
       or <agent>:<native-name> such as gemini:run_shell_command.

Options:
  --dir <path>            Project directory (default: current directory)
  --user                  Also read user-level configs from your home directory (read-only)
  --home <dir>            Like --user, with another home directory (for tests)
  --agents <list>         Comma list of claude,codex,gemini,antigravity (antigravity is experimental)
  --tool <tool>           Virtual tool call (see above)
  --input <json>          Tool input as a JSON object (default: {})
  --max-timeout <sec>     Shorten longer hook timeouts when running (default: 30)
  --fail-on-divergence    run: exit 1 when agents disagree
  --strict                lint: warnings also give exit 1
  --json                  Machine-readable output
  --lang <en|ko>          Output language (or HOOKPARITY_LANG, then LC_ALL / LC_MESSAGES / LANG)
  --version, --help

Exit codes: 0 ok, 1 mismatch / lint error / divergence, 2 usage or config error.
Hook commands really run in "run" and "test". Use "match" and "lint" on repositories you do not trust.
`,

  "col.agent": "Agent",
  "col.event": "Event",
  "col.matcher": "Matcher",
  "col.type": "Type",
  "col.command": "Command",
  "col.timeout": "Timeout (s)",
  "col.if": "if",
  "col.source": "Source",
  "col.how": "Matched as",
  "col.tool": "Tool",
  "col.verdict": "Verdict",
  "col.hooks": "Hooks",
  "col.findings": "Findings",
  "col.severity": "Severity",
  "col.id": "ID",
  "col.message": "Message",

  "verdict.allow": "allow",
  "verdict.block": "block",
  "verdict.ask": "ask",
  "verdict.skip": "n/a",

  "matchKind.all": "everything",
  "matchKind.exact": "exact name list",
  "matchKind.regex": "regex (unanchored)",
  "matchKind.invalid": "invalid regex",

  "if.none": "-",
  "if.true": "true",
  "if.false": "false (skipped)",
  "if.ignored": "ignored by this agent",
  "if.never-runs": "never runs (not a tool event)",

  "agent.experimental": "experimental",
  "list.none": "No hooks found in {dir}.",
  "list.count": "{count} hook(s) found.",
  "list.user": "User-level configs were read from {home} (read-only).",
  "match.header": "{agent} ({tool}): {count} hook(s) fire",
  "match.noTool": "{agent}: no counterpart tool for this call, skipped",
  "match.filtered": "{count} more matched by name but were filtered out by their if rule.",
  "match.notRunnable": "{type} handler: listed, not executed",
  "match.none": "No agents to check. Add hook configs or pass --agents.",
  "run.plan": "About to run {count} hook command(s) from your config:",
  "run.planNone": "No hook command matches this call, so nothing will run.",
  "run.divergent": "Agents disagree: {verdicts}",
  "run.same": "All agents agree: {verdict}",
  "run.capped": "capped to {sec}s",
  "run.hookLine": "{agent}: {command} -> exit {code}, {ms} ms, {decision}",
  "run.hookLineTimeout": "{agent}: {command} -> timed out after {sec}s, {ms} ms, {decision}",
  "test.ok": "ok    {name}",
  "test.fail": "FAIL  {name}",
  "test.mismatch": "      {agent}: expected {expected}, got {got}",
  "test.summary": "{passed}/{total} cases passed, {mismatches} mismatch(es).",
  "severity.error": "error",
  "severity.warn": "warn",
  "severity.info": "info",
  "lint.none": "No findings.",
  "lint.summary": "{total} finding(s): {errors} error, {warns} warn, {infos} info.",

  "error.config": "Cannot read {file}: {detail}",
  "config.notFound": "the file does not exist.",
  "config.unreadable": "the file cannot be opened ({code}).",
  "config.syntax": "it is not valid JSON / TOML.",
  "config.syntaxAt": "syntax error at line {line}, column {column}.",
  "config.syntaxEnd": "the file ends before the JSON is complete (a missing ] or }?).",
  "config.syntaxToken": "unexpected character '{token}' in the JSON.",
  "config.notObject": "the top level must be an object (JSON) or a table (TOML).",
  "cases.notObject": "the top level must be an object like {\"cases\": [...]}.",
  "cases.empty": "\"cases\" must be a non-empty array.",
  "cases.itemNotObject": "`{at}` must be an object.",
  "cases.needString": "`{field}` must be a non-empty string.",
  "cases.inputNotObject": "`{at}.input` must be an object.",
  "cases.expectMissing": "`{at}.expect` must be an object like {\"*\": \"block\"}.",
  "cases.unknownAgent": "`{at}.expect` has an unknown agent \"{agent}\". Use: {allowed}.",
  "cases.badDecision": "`{field}` must be one of: {allowed}.",
  "error.unknownTool": "Unknown tool \"{tool}\". Use shell, edit, write, read, mcp:<server>/<tool>, a Claude name like Bash, or <agent>:<name>.",
  "error.missingTool": "--tool is required, for example --tool shell.",
  "error.inputNotJson": "--input is not valid JSON. Example: --input '{\"command\":\"ls\"}'",
  "error.inputNotObject": "--input must be a JSON object, for example {\"command\":\"ls\"}.",
  "error.badLang": "--lang must be en or ko (got \"{value}\").",
  "error.badAgents": "Unknown agent \"{value}\" in --agents. Use: {allowed}.",
  "error.badNumber": "--max-timeout must be a positive number of seconds (got \"{value}\").",
  "error.unknownCommand": "Unknown command \"{command}\". Run 'hookparity --help'.",
  "error.unknownOption": "Unknown option {option}. Run 'hookparity --help'.",
  "error.optionNeedsValue": "Option {option} needs a value. Run 'hookparity --help'.",
  "error.optionTakesNoValue": "Option {option} does not take a value. Run 'hookparity --help'.",
  "error.badOption": "Invalid command line ({code}). Run 'hookparity --help'.",
  "error.noCasesFile": "test needs at least one cases file, for example: hookparity test hookparity.cases.json",
  "error.dirNotFound": "Directory not found: {dir}",
  "error.homeNotFound": "Home directory not found: {dir}",

  "finding.HP001": "`if` on {event} never runs: Claude Code evaluates `if` only on tool events, so this hook is skipped (rule: {rule}). Remove `if` or move the hook to a tool event.",
  "finding.HP002.ignored": "`if` ({rule}) is ignored by this agent: the hook fires on every call its matcher selects.",
  "finding.HP002.widened": "Claude Code limits this command with `if` ({rule}), but it runs without a filter in: {agents}. There it fires on many more calls.",
  "finding.HP003": "Matcher \"{matcher}\" uses permission-rule syntax. Matchers only see the tool name, so it never matches. Put the argument filter in a Claude Code `if` and keep the matcher to the tool name.",
  "finding.HP004": "MCP matcher \"{matcher}\" matches no real MCP tool name for this agent (Claude Code: mcp__<server>__<tool>, exact list; Gemini CLI: mcp_<server>_<tool>). Use mcp__<server>__.* for Claude Code or mcp_<server>_.* for Gemini CLI.",
  "finding.HP005.seconds": "Timeout {value} looks like it was written in milliseconds, but this agent reads the timeout in seconds, so it waits {value} seconds (over an hour). Write it in seconds, for example {suggest}.",
  "finding.HP005.milliseconds": "Timeout {value} looks like it was written in seconds, but this agent reads the timeout in milliseconds, so it waits only {value} milliseconds. Write it in milliseconds, for example {suggest}.",
  "finding.HP006": "Event {event} does not exist for this agent, so these hooks never fire.",
  "finding.HP007": "Matcher \"{matcher}\" names another agent's tool ({tools}); this agent calls its tools differently.",
  "finding.HP008": "Matcher \"{matcher}\" is not a valid regular expression, so it matches nothing.",
  "finding.HP009": "Project .codex hooks only run after the project and the hook are trusted in Codex (/hooks). hookparity cannot read that trust state.",
  "finding.HP101": "Decision JSON is not where this agent reads it (expects `{read}`, found `{found}`). The hook is treated as allow.",
  "finding.HP102": "Exit code {code} is not a block (only exit 2 blocks); the tool call proceeds. Use exit 2 for a block.",
  "finding.HP102.signal": "The hook was stopped by signal {signal}. That is not a block (only exit 2 blocks); the tool call proceeds.",
  "finding.HP103":"Codex does not support permissionDecision \"ask\"; the hook counts as failed and the call proceeds.",
  "finding.HP104.allow": "Hook timed out after {sec}s; this agent lets the call proceed unless the hook is set to block on failure, so the call is allowed.",
  "finding.HP104.block": "Hook timed out after {sec}s and the hook is set to block on failure, so the call is blocked.",
  "finding.HP105": "Exit 0 but stdout is not a JSON object (\"{sample}\"); the output is ignored and the call proceeds.",
} as const;

export type MessageKey = keyof typeof en;
