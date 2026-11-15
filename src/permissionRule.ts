/**
 * Evaluate a Claude Code `if` filter such as `Bash(git push*)` against one tool call.
 * Reproduces the documented permission-rule syntax: `Tool` or `Tool(pattern)`,
 * where `*` is a wildcard and the legacy `prefix:*` form means "starts with prefix".
 */

const RULE = /^([^()\s][^()]*?)\((.*)\)$/s;

/** The argument a rule pattern is compared with, per tool. */
function specifier(toolName: string, input: Record<string, unknown>): string | undefined {
  const pick = (key: string): string | undefined => {
    const v = input[key];
    return typeof v === "string" ? v : undefined;
  };
  switch (toolName) {
    case "Bash":
      return pick("command");
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return pick("file_path") ?? pick("path");
    default:
      return undefined;
  }
}

function globToRegExp(pattern: string): RegExp {
  const prefix = pattern.endsWith(":*") ? pattern.slice(0, -2) : undefined;
  const source = (prefix ?? pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(prefix !== undefined ? `^${source}(?:\\s.*)?$` : `^${source}$`, "s");
}

export function evalIfRule(rule: string, toolName: string, input: Record<string, unknown>): boolean {
  const trimmed = rule.trim();
  const m = RULE.exec(trimmed);
  if (!m) return trimmed === toolName;
  const [, name, pattern] = m as unknown as [string, string, string];
  if (name !== toolName) return false;
  if (pattern === "" || pattern === "*") return true;
  const arg = specifier(toolName, input);
  if (arg === undefined) return false;
  return globToRegExp(pattern).test(arg);
}
