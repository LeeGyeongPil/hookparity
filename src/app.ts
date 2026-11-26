import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadCases, runCases } from "./cases.js";
import { discover } from "./discover.js";
import { resolveLang, t, type Lang, type MessageKey } from "./i18n/index.js";
import { lint, hasErrors } from "./lint.js";
import { activeAgents, matchCall } from "./match.js";
import { ALL_AGENTS, ConfigError, DEFAULT_AGENTS, UsageError, type AgentId } from "./model.js";
import * as render from "./render.js";
import { executeMatches } from "./run.js";
import { packageVersion } from "./version.js";

export interface Context {
  env: Record<string, string | undefined>;
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  isTTY: boolean;
}

const OPTIONS = {
  dir: { type: "string" },
  user: { type: "boolean" },
  home: { type: "string" },
  agents: { type: "string" },
  tool: { type: "string" },
  input: { type: "string" },
  "max-timeout": { type: "string" },
  "fail-on-divergence": { type: "boolean" },
  strict: { type: "boolean" },
  json: { type: "boolean" },
  lang: { type: "string" },
  version: { type: "boolean" },
  help: { type: "boolean" },
} as const;

/** Find `--lang` in raw arguments, so errors before parsing can still be localized. */
function rawLangFlag(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--lang") return argv[i + 1];
    if (a.startsWith("--lang=")) return a.slice("--lang=".length);
  }
  return undefined;
}

function langFor(argv: readonly string[], ctx: Context): Lang {
  const flag = rawLangFlag(argv);
  return resolveLang(flag === "en" || flag === "ko" ? flag : undefined, ctx.env);
}

/** Run the CLI and return the exit code. All output goes through ctx. */
export async function run(argv: readonly string[], ctx: Context): Promise<number> {
  const lang = langFor(argv, ctx);
  try {
    return await dispatch(argv, ctx, lang);
  } catch (err) {
    if (err instanceof UsageError) {
      ctx.stderr(`hookparity: ${t(lang, err.key, err.params)}\n`);
      return 2;
    }
    if (err instanceof ConfigError) {
      // 이유도 메시지 키라서 고른 언어로 만든다
      const detail = t(lang, err.key, err.params);
      ctx.stderr(`hookparity: ${t(lang, "error.config", { file: err.file, detail })}\n`);
      return 2;
    }
    throw err;
  }
}

function parseAgents(value: string | undefined): AgentId[] | undefined {
  if (value === undefined) return undefined;
  const out: AgentId[] = [];
  for (const raw of value.split(",")) {
    const name = raw.trim();
    if (name === "") continue;
    if (!(ALL_AGENTS as readonly string[]).includes(name)) {
      throw new UsageError("error.badAgents", { value: name, allowed: ALL_AGENTS.join(", ") });
    }
    out.push(name as AgentId);
  }
  return out;
}

function parseInput(value: string | undefined): Record<string, unknown> {
  if (value === undefined) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // JSON 파서의 영어 문장은 보여 주지 않고, 언어별 안내 문구 + 올바른 예만 보여 준다
    throw new UsageError("error.inputNotJson");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new UsageError("error.inputNotObject");
  }
  return parsed as Record<string, unknown>;
}

function parseMaxTimeout(value: string | undefined): number {
  if (value === undefined) return 30;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new UsageError("error.badNumber", { value });
  return n;
}

/**
 * `--max-timeout -1` : parseArgs refuses a value that starts with "-" ("argument is ambiguous").
 * Join such a value to its option (`--max-timeout=-1`) so our own check gives the friendly message.
 * A following `--option` is left alone (then parseArgs reports the missing value).
 */
function joinDashValues(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    const next = argv[i + 1];
    const name = a.startsWith("--") ? a.slice(2) : "";
    const isStringOption = name in OPTIONS && OPTIONS[name as keyof typeof OPTIONS].type === "string";
    if (isStringOption && next !== undefined && next.startsWith("-") && !next.startsWith("--")) {
      out.push(`${a}=${next}`);
      i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

/** Map a node:util parseArgs error (English text) to one of our message keys. */
function parseArgsError(err: unknown): UsageError {
  const code = err instanceof Error && "code" in err ? String(err.code) : "";
  const message = err instanceof Error ? err.message : "";
  // parseArgs 문장에서 옵션 이름만 꺼낸다: "Unknown option '--bogus'" -> --bogus
  const option = /'(-{1,2}[^' =]+)/.exec(message)?.[1] ?? "?";
  if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") return new UsageError("error.unknownOption", { option });
  if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
    const name = option.replace(/^-+/, "");
    const isString = name in OPTIONS && OPTIONS[name as keyof typeof OPTIONS].type === "string";
    return new UsageError(isString ? "error.optionNeedsValue" : "error.optionTakesNoValue", { option });
  }
  return new UsageError("error.badOption", { code: code || "?" });
}

function isDir(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

async function dispatch(argv: readonly string[], ctx: Context, lang: Lang): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args: joinDashValues(argv), options: OPTIONS, allowPositionals: true, strict: true });
  } catch (err) {
    throw parseArgsError(err);
  }
  const { values, positionals } = parsed;

  if (values.lang !== undefined && values.lang !== "en" && values.lang !== "ko") {
    throw new UsageError("error.badLang", { value: values.lang });
  }
  if (values.version) {
    ctx.stdout(`${packageVersion()}\n`);
    return 0;
  }
  const command = positionals[0];
  if (values.help || command === "help") {
    ctx.stdout(t(lang, "help.text", { version: packageVersion() }));
    return 0;
  }
  if (command === undefined) {
    ctx.stderr(t(lang, "help.text", { version: packageVersion() }));
    return 2;
  }
  if (!["list", "match", "run", "test", "lint"].includes(command)) {
    throw new UsageError("error.unknownCommand", { command });
  }
  // Validate for every command so a bad value is never silently ignored (only run/test use it).
  const maxTimeoutSec = parseMaxTimeout(values["max-timeout"]);

  const dir = resolve(ctx.cwd, values.dir ?? ".");
  if (!isDir(dir)) throw new UsageError("error.dirNotFound", { dir });
  let home: string | undefined;
  if (values.home !== undefined) {
    home = resolve(ctx.cwd, values.home);
    if (!isDir(home)) throw new UsageError("error.homeNotFound", { dir: home });
  } else if (values.user) {
    home = ctx.env["HOME"] ?? homedir();
  }
  const selected = parseAgents(values.agents);
  const asJson = values.json === true;
  const style: render.Style = { lang, color: ctx.isTTY && !asJson && !ctx.env["NO_COLOR"] };
  const out = (text: string): void => ctx.stdout(`${text}\n`);

  const entries = discover({ dir, home });

  switch (command) {
    case "list": {
      const shown = selected ? entries.filter((e) => selected.includes(e.agent)) : entries;
      out(asJson ? render.listJson(dir, shown) : render.listText(style, dir, shown, home));
      return 0;
    }
    case "lint": {
      const subject = selected ? entries.filter((e) => selected.includes(e.agent)) : entries;
      const findings = lint(subject);
      out(asJson ? render.lintJson(lang, findings) : render.lintText(style, findings));
      return hasErrors(findings, values.strict === true) ? 1 : 0;
    }
    case "match":
    case "run": {
      if (!values.tool) throw new UsageError("error.missingTool");
      const input = parseInput(values.input);
      const agents = activeAgents(entries, selected, DEFAULT_AGENTS);
      const matches = matchCall(entries, values.tool, input, agents);
      if (command === "match") {
        out(asJson ? render.matchJson(values.tool, input, matches) : render.matchText(style, values.tool, matches));
        return 0;
      }
      if (!asJson) ctx.stderr(`${render.planText(lang, matches)}\n\n`);
      const report = await executeMatches(matches, { dir, input, maxTimeoutSec });
      out(asJson ? render.resultJson(lang, values.tool, input, report) : render.resultText(style, report));
      return values["fail-on-divergence"] && report.divergent ? 1 : 0;
    }
    case "test": {
      if (positionals.length < 2) throw new UsageError("error.noCasesFile");
      const files: render.FileCases[] = [];
      for (const file of positionals.slice(1)) {
        const cases = loadCases(resolve(ctx.cwd, file));
        files.push({ file, cases: await runCases(cases, entries, { dir, maxTimeoutSec, agents: selected }) });
      }
      out(asJson ? render.testJson(lang, files) : render.testText(style, files));
      const bad = files.some((f) => f.cases.some((c) => c.mismatches.length > 0));
      return bad ? 1 : 0;
    }
    default:
      return 2;
  }
}
