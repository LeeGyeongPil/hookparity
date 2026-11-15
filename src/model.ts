// Shared types for hookparity.
import { t, type MessageKey } from "./i18n/index.js";

export type AgentId = "claude" | "codex" | "gemini" | "antigravity";

export const ALL_AGENTS: readonly AgentId[] = ["claude", "codex", "gemini", "antigravity"];
/** Agents that are evaluated by default. Antigravity is experimental and opt-in. */
export const DEFAULT_AGENTS: readonly AgentId[] = ["claude", "codex", "gemini"];

export type Decision = "allow" | "block" | "ask";
export type Severity = "error" | "warn" | "info";

/** One hook handler, flattened from event -> matcher group -> handler. */
export interface HookEntry {
  agent: AgentId;
  event: string;
  /** Matcher string of the group; undefined when the group has none. */
  matcher: string | undefined;
  /** Handler type, e.g. "command", "http", "prompt". Only "command" is executed. */
  type: string;
  command: string | undefined;
  /** Claude Code `if` permission-rule filter (raw text). */
  ifRule: string | undefined;
  /** Timeout normalized to seconds; null when the config does not set one. */
  timeoutSec: number | null;
  /** Timeout exactly as written in the config (seconds for Claude/Codex, ms for Gemini). */
  timeoutRaw: number | null;
  /** Claude Code `onFailure` value. */
  onFailure: string | undefined;
  /** Human readable source: path relative to --dir, or "~/..." for user configs. */
  source: string;
  /** Absolute path of the config file. */
  file: string;
  scope: "project" | "user";
  experimental: boolean;
  /** Index of the matcher group in its event array (for messages). */
  groupIndex: number;
}

/** A diagnostic. Text is produced at render time from the id and params. */
export interface Finding {
  id: string;
  severity: Severity;
  params: Record<string, string | number>;
  agent?: AgentId;
  source?: string;
}

/**
 * A wrong command line (CLI exit code 2).
 * Carries a message key + params, so the CLI can print it in the user's language.
 * `message` is the English text (for library callers).
 */
export class UsageError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params: Record<string, string | number> = {},
  ) {
    super(t("en", key, params));
    this.name = "UsageError";
  }
}

/**
 * A config or cases file that could not be read or parsed (CLI exit code 2).
 * The reason is a message key (never a raw parser text), so Korean output stays Korean.
 */
export class ConfigError extends Error {
  constructor(
    readonly file: string,
    readonly key: MessageKey,
    readonly params: Record<string, string | number> = {},
  ) {
    super(`${file}: ${t("en", key, params)}`);
    this.name = "ConfigError";
  }

  /** English reason (kept for library callers). */
  get detail(): string {
    return t("en", this.key, this.params);
  }
}

/**
 * Turn a JSON / TOML parser exception into a ConfigError with a line and column when we can find one.
 * The parser's own English sentence is not shown (it would leak into Korean output).
 */
export function syntaxError(file: string, text: string, err: unknown): ConfigError {
  // smol-toml TomlError has numeric line / column
  if (err instanceof Error && "line" in err && typeof err.line === "number") {
    const column = "column" in err && typeof err.column === "number" ? err.column : 1;
    return new ConfigError(file, "config.syntaxAt", { line: err.line, column });
  }
  const message = err instanceof Error ? err.message : "";
  // JSON.parse: "... at position 12 (line 2 column 5)"
  const lc = /line (\d+) column (\d+)/.exec(message);
  if (lc) return new ConfigError(file, "config.syntaxAt", { line: Number(lc[1]), column: Number(lc[2]) });
  const pos = /position (\d+)/.exec(message);
  if (pos) {
    const before = text.slice(0, Number(pos[1]));
    const lines = before.split("\n");
    return new ConfigError(file, "config.syntaxAt", { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 });
  }
  if (/Unexpected end/.test(message)) return new ConfigError(file, "config.syntaxEnd");
  const token = /Unexpected token '(.+?)'/.exec(message);
  if (token) return new ConfigError(file, "config.syntaxToken", { token: token[1] as string });
  return new ConfigError(file, "config.syntax");
}

/** Turn a file-system exception (missing file, no permission) into a ConfigError. */
export function readError(file: string, err: unknown): ConfigError {
  const code = err instanceof Error && "code" in err ? String(err.code) : "";
  if (code === "ENOENT") return new ConfigError(file, "config.notFound");
  return new ConfigError(file, "config.unreadable", { code: code || "?" });
}
