import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AGENTS } from "../src/agents/index.js";
import { discover } from "../src/discover.js";
import { en } from "../src/i18n/en.js";
import { ko } from "../src/i18n/ko.js";
import { findingKey, langFromLocale, resolveLang, t } from "../src/i18n/index.js";
import { displayWidth } from "../src/render.js";
import { cli, EXAMPLE, FIXED, FIXTURES, ROOT, type CliResult } from "./helpers.js";

const CURL = '{"command":"curl https://example.com"}';
const hasHangul = (s: string): boolean => /[가-힣]/.test(s);

describe("AC-8 languages", () => {
  it("en.ts and ko.ts have identical key sets and the same placeholders", () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const vars = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
      expect(vars(ko[key]), key).toEqual(vars(en[key]));
      expect(ko[key].trim().length, key).toBeGreaterThan(0);
    }
  });

  it("has a message for every finding id the code can emit", () => {
    for (const id of ["HP001", "HP003", "HP004", "HP006", "HP007", "HP008", "HP009", "HP101", "HP102", "HP103", "HP105"]) {
      expect(en).toHaveProperty(`finding.${id}`);
    }
    expect(en).toHaveProperty(findingKey("HP005", { agentUnit: "seconds" }));
    expect(en).toHaveProperty(findingKey("HP005", { agentUnit: "milliseconds" }));
    expect(en).toHaveProperty(findingKey("HP102", { signal: "SIGTERM" }));
    expect(findingKey("HP102", { code: 1 })).toBe("finding.HP102");
    expect(en).toHaveProperty(findingKey("HP104", { outcome: "allow" }));
    expect(en).toHaveProperty(findingKey("HP104", { outcome: "block" }));
    expect(en).toHaveProperty(findingKey("HP002", { kind: "ignored" }));
    expect(en).toHaveProperty(findingKey("HP002", { kind: "widened" }));
  });

  it("resolves the language: --lang > HOOKPARITY_LANG > LC_ALL > LC_MESSAGES > LANG", () => {
    expect(resolveLang("ko", { HOOKPARITY_LANG: "en" })).toBe("ko");
    expect(resolveLang("en", { HOOKPARITY_LANG: "ko", LANG: "ko_KR.UTF-8" })).toBe("en");
    expect(resolveLang(undefined, { HOOKPARITY_LANG: "ko", LC_ALL: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LC_ALL: "ko_KR.UTF-8", LANG: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LC_MESSAGES: "ko_KR.UTF-8", LANG: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LC_ALL: "", LANG: "ko_KR.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LANG: "ko_KR.UTF-8" })).toBe("ko");
    expect(resolveLang(undefined, { LANG: "fr_FR.UTF-8" })).toBe("en");
    expect(resolveLang(undefined, {})).toBe("en");
    expect(langFromLocale("KO")).toBe("ko");
  });

  it("t() fills placeholders and leaves unknown ones visible", () => {
    expect(t("en", "list.count", { count: 3 })).toBe("3 hook(s) found.");
    expect(t("ko", "list.count", { count: 3 })).toBe("훅 3개를 찾았습니다.");
    expect(t("en", "list.count")).toContain("{count}");
  });

  it("--help is Korean with --lang ko and English with --lang en", async () => {
    const ko = await cli(["--help", "--lang", "ko"], { LANG: "C" });
    const en = await cli(["--help", "--lang", "en"], { LANG: "ko_KR.UTF-8" });
    expect(ko.code).toBe(0);
    expect(ko.stdout).toContain("사용법:");
    expect(hasHangul(ko.stdout)).toBe(true);
    expect(en.stdout).toContain("Usage:");
    expect(hasHangul(en.stdout)).toBe(false);
  });

  it("run/test --lang ko on the bundled example leaves no untranslated English values", async () => {
    for (const args of [["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL], ["test", "--dir", EXAMPLE]]) {
      const r = await cli([...args, "--lang", "ko"]);
      for (const bad of [" no)", " yes)", "allow)", "block)", "exit timed"]) expect(r.stdout, bad).not.toContain(bad);
    }
  });

  it("a timed-out hook line does not say 'exit timed out'", async () => {
    const r = await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL]);
    expect(r.stdout).not.toMatch(/exit timed out/);
    expect(r.stdout).toMatch(/-> timed out after 1s/);
  });

  it("run table headers switch language", async () => {
    const ko = await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL, "--lang", "ko"], { LANG: "C" });
    expect(ko.stdout).toMatch(/에이전트\s+도구\s+판정\s+훅\s+발견/);
    expect(ko.stdout).toContain("차단");
    expect(ko.stdout).toContain("허용");
    const en = await cli(["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL, "--lang", "en"], { LANG: "C" });
    expect(en.stdout).toMatch(/Agent\s+Tool\s+Verdict\s+Hooks\s+Findings/);
    expect(hasHangul(en.stdout)).toBe(false);
    expect(en.stderr).not.toMatch(/[가-힣]/);
  });

  it("HOOKPARITY_LANG=ko and LANG=ko_KR.UTF-8 give Korean; --lang en overrides them", async () => {
    const args = ["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL];
    expect((await cli(args, { HOOKPARITY_LANG: "ko" })).stdout).toContain("판정");
    expect((await cli(args, { LANG: "ko_KR.UTF-8" })).stdout).toContain("판정");
    expect((await cli([...args, "--lang", "en"], { HOOKPARITY_LANG: "ko", LANG: "ko_KR.UTF-8" })).stdout).toContain("Verdict");
  });

  it("LANG=fr_FR.UTF-8 and an empty environment give English", async () => {
    const args = ["lint", "--dir", EXAMPLE];
    expect((await cli(args, { LANG: "fr_FR.UTF-8" })).stdout).toContain("Severity");
    expect((await cli(args, {})).stdout).toContain("Severity");
  });

  it("errors and findings are localized too", async () => {
    const err = await cli(["run", "--dir", EXAMPLE, "--lang", "ko"], {});
    expect(err.code).toBe(2);
    expect(err.stderr).toContain("--tool 이 필요합니다");
    const lint = await cli(["lint", "--dir", EXAMPLE, "--lang", "ko", "--json"], {});
    expect(JSON.parse(lint.stdout).findings[0].message).toMatch(/[가-힣]/);
  });

  it("rejects an unsupported --lang value", async () => {
    const r = await cli(["list", "--lang", "fr"], {});
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--lang must be en or ko");
  });

  it("measures Hangul as double width for table alignment", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("판정")).toBe(4);
  });
});

// ---------------------------------------------------------------------------------------------
// Full sweep: every command and every error path, once in English and once in Korean.
// Korean output may keep data (paths, hook commands, matchers, tool / agent / event names,
// option names, rule IDs) but no English sentence words from hookparity itself.
// ---------------------------------------------------------------------------------------------

interface Scenario {
  name: string;
  args: string[];
  /** Expected exit code. */
  code: number;
  /** Project / home directories whose hook data may appear in the output. */
  dirs?: string[];
  /** Read `message` fields from --json output instead of scanning the raw text. */
  json?: boolean;
}

interface Outcome {
  scenario: Scenario;
  en: CliResult;
  ko: CliResult;
  data: string[];
}

/** Words that may stay in Korean output: names of agents, products, tools, events, commands. */
const ALLOWED_WORDS = new Set<string>([
  ...Object.values(AGENTS).flatMap((a) => [a.id, ...a.events, ...a.toolNames]),
  "Claude", "Code", "Codex", "Gemini", "Antigravity",
  "hookparity", "stdin", "stdout", "if", "json",
  "list", "match", "run", "test", "lint", "help",
  "shell", "edit", "write", "read", "mcp", "en", "ko", "permissionDecision",
]);

/** English words the QA reports found leaking; never allowed in Korean output. */
const LEAK_WORDS = /\b(error|warn|info|expected|seconds|milliseconds|allow|block|ask|yes|no|true|false|ok|timed|exit|signal|null|got)\b/;

/** Strip data and identifiers, then return the English words that are left. */
function leftoverEnglish(text: string, data: readonly string[]): string[] {
  let s = text;
  for (const d of [...data].filter((x) => x.length >= 2).sort((a, b) => b.length - a.length)) s = s.split(d).join(" ");
  s = s
    .replace(/"[^"\n]*"/g, " ") // quoted values
    .replace(/'[^'\n]*'/g, " ")
    .replace(/`[^`\n]*`/g, " ") // code spans such as `if`, `exit 2`
    .replace(/\S*[/\\]\S*/g, " ") // paths
    .replace(/[\w-]+\([^)]*\)/g, " ") // permission rules such as Bash(ls)
    .replace(/--?[A-Za-z][\w-]*/g, " ") // option names
    .replace(/[\w*<>-]+(?:[.:_][\w*<>-]+)+/g, " ") // identifiers: a.b, decision:maybe, mcp__s__t, cases[0].name
    .replace(/\b[A-Z][A-Z0-9_]+\b/g, " "); // JSON, TOML, MCP, HP005, SIGTERM, LANG ...
  return (s.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !ALLOWED_WORDS.has(w));
}

/** Text to check: the raw stdout + stderr, or the `message` fields of a --json result. */
function visibleText(r: CliResult, json: boolean): string {
  if (!json) return `${r.stdout}\n${r.stderr}`;
  const messages: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (k === "message" && typeof x === "string") messages.push(x);
        else walk(x);
      }
    }
  };
  walk(JSON.parse(r.stdout));
  return messages.join("\n");
}

/** Hook commands, matchers, rules, events and sources of the configs a scenario reads. */
function hookData(dirs: readonly string[]): string[] {
  const out: string[] = [];
  for (const dir of dirs) {
    try {
      for (const e of discover({ dir, home: dir })) {
        // e.type is the handler type exactly as written in the config ("command", "prompt")
        for (const v of [e.command, e.matcher, e.ifRule, e.event, e.source, e.file, e.type]) if (v) out.push(v);
      }
    } catch {
      /* malformed fixtures: their errors are part of the sweep */
    }
  }
  return out;
}

/** Case names of every cases file passed on the command line. */
function caseNames(args: readonly string[]): string[] {
  const out: string[] = [];
  for (const a of args.filter((x) => x.endsWith(".json"))) {
    try {
      const raw = JSON.parse(readFileSync(a, "utf8")) as { cases?: { name?: string }[] };
      for (const c of raw.cases ?? []) if (typeof c.name === "string") out.push(c.name);
    } catch {
      /* invalid cases files are part of the sweep */
    }
  }
  return out;
}

describe("AC-8 i18n sweep: every command and error path in Korean", () => {
  const tmp = mkdtempSync(join(tmpdir(), "hp-i18n-"));
  const outcomes: Outcome[] = [];
  /** Keys whose Korean text could not be reached on this machine (e.g. chmod has no effect as root). */
  const unreachable = new Set<string>(["error.badOption", "config.syntax"]); // defensive fallbacks only

  const file = (rel: string, content: string): string => {
    const p = join(tmp, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content);
    return p;
  };

  // A project whose hooks produce every run-time finding: HP101-HP105, both HP104 variants, a signal exit.
  const verdicts = join(tmp, "verdicts");
  const sleepy = (s: number): string => `sleep ${s}`;
  file(
    "verdicts/.claude/settings.json",
    JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              { type: "command", command: "exit 1" },
              { type: "command", command: "kill -TERM $$" },
              { type: "command", command: "echo plain-text" },
              { type: "command", command: `printf '{"decision":"maybe"}'` },
              { type: "command", command: sleepy(5) },
              { type: "command", command: sleepy(4), onFailure: "block" },
              { type: "prompt", prompt: "check" },
            ],
          },
        ],
      },
    }),
  );
  file(
    "verdicts/.codex/hooks.json",
    JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: `printf '{"hookSpecificOutput":{"permissionDecision":"ask"}}'` }] }] } }),
  );
  file(
    "verdicts/.gemini/settings.json",
    JSON.stringify({ hooks: { BeforeTool: [{ matcher: "run_shell_command", hooks: [{ type: "command", command: `printf '{"hookSpecificOutput":{"permissionDecision":"deny"}}'` }] }] } }),
  );
  const topArray = join(tmp, "toparray");
  file("toparray/.gemini/settings.json", "[1,2]");
  const empty = join(tmp, "empty");
  mkdirSync(empty);

  // Cases files: one per schema / syntax problem, plus an "ask" expectation that mismatches.
  const cases = (name: string, content: string): string => file(`cases/${name}.json`, content);
  const askCases = cases("ask", JSON.stringify({ cases: [{ name: "listing", tool: "shell", input: { command: "ls" }, expect: { "*": "ask" } }] }));
  const badCases: [string, string][] = [
    ["notObject", "[]"],
    ["empty", "{}"],
    ["itemNotObject", '{"cases":[1]}'],
    ["needString", '{"cases":[{"tool":"shell","expect":{"*":"block"}}]}'],
    ["inputNotObject", '{"cases":[{"name":"x","tool":"shell","input":[1],"expect":{"*":"block"}}]}'],
    ["expectMissing", '{"cases":[{"name":"x","tool":"shell"}]}'],
    ["unknownAgent", '{"cases":[{"name":"x","tool":"shell","expect":{"cursor":"block"}}]}'],
    ["badDecision", '{"cases":[{"name":"x","tool":"shell","expect":{"*":"maybe"}}]}'],
    ["syntaxEnd", '{"cases": ['],
    ["syntaxToken", '{"cases":tru}'],
    ["syntaxAt", '{"cases":1,}'],
  ];
  const locked = cases("locked", '{"cases":[]}');
  chmodSync(locked, 0o000);
  let lockedWorks = true;
  try {
    readFileSync(locked);
    lockedWorks = false; // running as root: permissions are not enforced
  } catch {
    /* expected: EACCES */
  }
  if (!lockedWorks) unreachable.add("config.unreadable");

  const CROSS_CASES = join(EXAMPLE, "hookparity.cases.json");
  const FIXED_CASES = join(FIXED, "hookparity.cases.json");
  const HOME = join(FIXTURES, "home");
  const BROKEN = join(FIXTURES, "broken");

  const scenarios: Scenario[] = [
    // normal output of every command
    { name: "help", args: ["--help"], code: 0 },
    { name: "no command", args: [], code: 2 },
    { name: "list example", args: ["list", "--dir", EXAMPLE], code: 0, dirs: [EXAMPLE] },
    { name: "list home", args: ["list", "--dir", EXAMPLE, "--home", HOME, "--agents", "claude,antigravity"], code: 0, dirs: [EXAMPLE, HOME] },
    { name: "list empty", args: ["list", "--dir", empty], code: 0 },
    { name: "match mcp", args: ["match", "--dir", EXAMPLE, "--tool", "mcp:memory/create_entities"], code: 0, dirs: [EXAMPLE] },
    { name: "match filtered by if", args: ["match", "--dir", EXAMPLE, "--tool", "shell", "--input", '{"command":"ls"}'], code: 0, dirs: [EXAMPLE] },
    { name: "match no counterpart", args: ["match", "--dir", EXAMPLE, "--tool", "read"], code: 0, dirs: [EXAMPLE] },
    { name: "match not runnable", args: ["match", "--dir", verdicts, "--tool", "shell"], code: 0, dirs: [verdicts] },
    { name: "match no agents", args: ["match", "--dir", empty, "--tool", "shell"], code: 0 },
    { name: "run example", args: ["run", "--dir", EXAMPLE, "--tool", "shell", "--input", CURL], code: 0, dirs: [EXAMPLE] },
    { name: "run fixed", args: ["run", "--dir", FIXED, "--tool", "shell", "--input", CURL], code: 0, dirs: [FIXED] },
    { name: "run nothing to run", args: ["run", "--dir", EXAMPLE, "--tool", "read"], code: 0, dirs: [EXAMPLE] },
    { name: "run all findings", args: ["run", "--dir", verdicts, "--tool", "shell", "--max-timeout", "1"], code: 0, dirs: [verdicts] },
    { name: "run all findings json", args: ["run", "--dir", verdicts, "--tool", "shell", "--max-timeout", "1", "--json"], code: 0, dirs: [verdicts], json: true },
    { name: "test example", args: ["test", CROSS_CASES, "--dir", EXAMPLE], code: 1, dirs: [EXAMPLE] },
    { name: "test fixed", args: ["test", FIXED_CASES, "--dir", FIXED], code: 0, dirs: [FIXED] },
    { name: "test ask", args: ["test", askCases, "--dir", EXAMPLE], code: 1, dirs: [EXAMPLE] },
    { name: "lint example", args: ["lint", "--dir", EXAMPLE], code: 1, dirs: [EXAMPLE] },
    { name: "lint broken", args: ["lint", "--dir", BROKEN], code: 1, dirs: [BROKEN] },
    { name: "lint broken json", args: ["lint", "--dir", BROKEN, "--json"], code: 1, dirs: [BROKEN], json: true },
    { name: "lint clean", args: ["lint", "--dir", join(FIXTURES, "clean")], code: 0 },
    // usage errors
    { name: "unknown command", args: ["explode"], code: 2 },
    { name: "unknown option", args: ["list", "--bogus"], code: 2 },
    { name: "option needs value", args: ["list", "--dir"], code: 2 },
    { name: "option takes no value", args: ["list", "--json=1"], code: 2 },
    { name: "bad --lang", args: ["list", "--lang", "fr"], code: 2 },
    { name: "missing --tool", args: ["run", "--dir", EXAMPLE], code: 2 },
    { name: "unknown tool", args: ["match", "--dir", EXAMPLE, "--tool", "frobnicate"], code: 2 },
    { name: "unknown agent", args: ["list", "--dir", EXAMPLE, "--agents", "cursor"], code: 2 },
    { name: "input not JSON", args: ["run", "--dir", EXAMPLE, "--tool", "shell", "--input", "{bad"], code: 2 },
    { name: "input not object", args: ["run", "--dir", EXAMPLE, "--tool", "shell", "--input", "[1]"], code: 2 },
    { name: "max-timeout negative (space)", args: ["run", "--dir", EXAMPLE, "--tool", "shell", "--max-timeout", "-1"], code: 2 },
    { name: "max-timeout zero (=)", args: ["run", "--dir", EXAMPLE, "--tool", "shell", "--max-timeout=0"], code: 2 },
    { name: "no cases file", args: ["test", "--dir", EXAMPLE], code: 2 },
    { name: "dir not found", args: ["list", "--dir", join(tmp, "nope")], code: 2 },
    { name: "home not found", args: ["list", "--dir", EXAMPLE, "--home", join(tmp, "nope")], code: 2 },
    // config / cases file errors
    { name: "malformed JSON config", args: ["list", "--dir", join(FIXTURES, "malformed")], code: 2 },
    { name: "malformed TOML config", args: ["list", "--dir", join(FIXTURES, "malformed-toml")], code: 2 },
    { name: "config top level array", args: ["lint", "--dir", topArray], code: 2 },
    { name: "cases file missing", args: ["test", join(tmp, "missing.json"), "--dir", EXAMPLE], code: 2 },
    ...(lockedWorks ? [{ name: "cases file unreadable", args: ["test", locked, "--dir", EXAMPLE], code: 2 }] : []),
    ...badCases.map(([name, content]) => ({ name: `cases ${name}`, args: ["test", cases(name, content), "--dir", EXAMPLE], code: 2 })),
  ];

  beforeAll(async () => {
    for (const scenario of scenarios) {
      // language through HOOKPARITY_LANG, so the "--lang fr" scenario still has a language
      const enRes = await cli(scenario.args, { HOOKPARITY_LANG: "en" });
      const koRes = await cli(scenario.args, { HOOKPARITY_LANG: "ko" });
      const data = [...hookData(scenario.dirs ?? []), ...caseNames(scenario.args), ...scenario.args, tmp, ROOT];
      outcomes.push({ scenario, en: enRes, ko: koRes, data });
    }
  }, 120000);

  afterAll(() => {
    try {
      chmodSync(locked, 0o600);
    } catch {
      /* already gone */
    }
    rmSync(tmp, { recursive: true, force: true });
  });

  it("exits with the same, expected code in both languages", () => {
    for (const o of outcomes) {
      expect(o.en.code, `${o.scenario.name} (en)`).toBe(o.scenario.code);
      expect(o.ko.code, `${o.scenario.name} (ko)`).toBe(o.scenario.code);
    }
  });

  it("Korean output is Korean and has no English words from hookparity itself", () => {
    const problems: string[] = [];
    for (const o of outcomes) {
      const text = visibleText(o.ko, o.scenario.json === true);
      if (!hasHangul(text)) problems.push(`${o.scenario.name}: no Korean text`);
      const left = leftoverEnglish(text, o.data);
      if (left.length > 0) problems.push(`${o.scenario.name}: ${[...new Set(left)].join(", ")}`);
      const leak = LEAK_WORDS.exec(leftoverEnglish(text, o.data).join(" "));
      if (leak) problems.push(`${o.scenario.name}: leaked "${leak[0]}"`);
    }
    expect(problems).toEqual([]);
  });

  it("English output has no Korean, and no output has an unfilled {placeholder}", () => {
    for (const o of outcomes) {
      const enText = visibleText(o.en, o.scenario.json === true);
      expect(hasHangul(enText), o.scenario.name).toBe(false);
      expect(enText, o.scenario.name).not.toMatch(/\{[A-Za-z]+\}/);
      expect(visibleText(o.ko, o.scenario.json === true), o.scenario.name).not.toMatch(/\{[A-Za-z]+\}/);
    }
  });

  it("every error, file-problem, finding, run, test and lint message is reached by the sweep in Korean", () => {
    const allKo = outcomes.map((o) => visibleText(o.ko, o.scenario.json === true)).join("\n");
    const prefixes = ["error.", "config.", "cases.", "finding.", "severity.", "verdict.", "run.", "test.", "lint.", "list.", "match.", "help."];
    const missing: string[] = [];
    for (const key of Object.keys(ko) as (keyof typeof ko)[]) {
      if (!prefixes.some((p) => key.startsWith(p)) || unreachable.has(key)) continue;
      // the longest fixed piece of the Korean template must appear somewhere in the output
      const pieces = ko[key].split(/\{\w+\}/).map((p) => p.trim()).sort((a, b) => b.length - a.length);
      if (!allKo.includes(pieces[0] as string)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it("Q-1 regression: HP005 states the agent's real unit (Claude seconds, Gemini milliseconds) in both languages", () => {
    const lintBroken = outcomes.find((o) => o.scenario.name === "lint broken json") as Outcome;
    const findings = (r: CliResult): { agent: string; message: string; params: Record<string, unknown> }[] =>
      (JSON.parse(r.stdout).findings as { id: string; agent: string; message: string; params: Record<string, unknown> }[]).filter((f) => f.id === "HP005");
    const enF = findings(lintBroken.en);
    const koF = findings(lintBroken.ko);
    const enClaude = enF.find((f) => f.agent === "claude")?.message ?? "";
    const enGemini = enF.find((f) => f.agent === "gemini")?.message ?? "";
    expect(enClaude).toMatch(/reads the timeout in seconds/);
    expect(enClaude).not.toMatch(/reads the timeout in milliseconds/);
    expect(enClaude).toMatch(/for example 5\./);
    expect(enGemini).toMatch(/reads the timeout in milliseconds/);
    expect(enGemini).not.toMatch(/reads the timeout in seconds/);
    expect(enGemini).toMatch(/for example 5000\./);
    const koClaude = koF.find((f) => f.agent === "claude")?.message ?? "";
    const koGemini = koF.find((f) => f.agent === "gemini")?.message ?? "";
    expect(koClaude).toContain("초 단위로 읽어");
    expect(koClaude).not.toContain("밀리초 단위로 읽어");
    expect(koGemini).toContain("밀리초 단위로 읽어");
    expect(enF.find((f) => f.agent === "claude")?.params["agentUnit"]).toBe("seconds");
    expect(enF.find((f) => f.agent === "gemini")?.params["agentUnit"]).toBe("milliseconds");
    // the unit table the message uses is the one discover uses to normalize timeouts
    expect(AGENTS.claude.timeoutUnit).toBe("seconds");
    expect(AGENTS.codex.timeoutUnit).toBe("seconds");
    expect(AGENTS.gemini.timeoutUnit).toBe("milliseconds");
  });

  it("Q-2 regression: lint severity column and --input errors are translated", () => {
    for (const name of ["lint example", "lint broken"]) {
      const o = outcomes.find((x) => x.scenario.name === name) as Outcome;
      const rows = o.ko.stdout.split("\n").slice(2).filter((l) => /HP\d{3}/.test(l));
      expect(rows.length, name).toBeGreaterThan(0);
      for (const row of rows) expect(row, name).toMatch(/^(오류|경고|정보)\s/);
      expect(o.ko.stdout, name).not.toMatch(/^(error|warn|info)\s/m);
      for (const bad of ["expected", "seconds", "milliseconds"]) expect(o.ko.stdout, `${name} ${bad}`).not.toContain(bad);
      // --json keeps the raw severity values
      expect(o.en.stdout).toMatch(/^error\s/m);
    }
    const notObject = outcomes.find((x) => x.scenario.name === "input not object") as Outcome;
    expect(notObject.ko.stderr).not.toContain("expected");
    expect(notObject.ko.stderr).toContain("JSON 객체여야");
  });

  it("Q-3 regression: the separator under the last table column stays short", () => {
    const o = outcomes.find((x) => x.scenario.name === "lint example") as Outcome;
    for (const out of [o.en.stdout, o.ko.stdout]) {
      const rule = out.split("\n")[1] as string;
      const lastDashes = rule.split("  ").at(-1) as string;
      expect(lastDashes.length).toBeLessThanOrEqual(40);
      expect(rule.length).toBeLessThan(120);
    }
  });

  it("Q-4 regression: --max-timeout -1 gives the friendly number message without a double period", () => {
    const o = outcomes.find((x) => x.scenario.name === "max-timeout negative (space)") as Outcome;
    expect(o.en.stderr).toContain('--max-timeout must be a positive number of seconds (got "-1")');
    expect(o.ko.stderr).toContain("--max-timeout 은 0보다 큰 초 단위 숫자여야 합니다");
    // a sentence that ends in ".." (help text "<cases.json...>" is fine)
    for (const x of outcomes) expect(`${x.en.stderr}${x.ko.stderr}`, x.scenario.name).not.toMatch(/[^.]\.\.(\s|$)/);
  });
});
