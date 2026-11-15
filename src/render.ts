import type { CaseResult } from "./cases.js";
import { findingKey, t, type Lang, type MessageKey } from "./i18n/index.js";
import type { AgentMatch, Hit } from "./match.js";
import type { Decision, Finding, HookEntry } from "./model.js";
import type { AgentResult, HookOutcome, RunReport } from "./run.js";
import { AGENTS } from "./agents/index.js";

export interface Style {
  lang: Lang;
  color: boolean;
}

// ---------------------------------------------------------------- helpers

function charWidth(cp: number): number {
  const wide =
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6);
  return wide ? 2 : 1;
}

/** Terminal column width (Hangul and CJK take two columns). */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch.codePointAt(0) as number);
  return w;
}

function pad(s: string, width: number): string {
  return s + " ".repeat(Math.max(0, width - displayWidth(s)));
}

const ANSI = { red: "31", green: "32", yellow: "33", bold: "1", dim: "2" } as const;

export function paint(style: Style, code: keyof typeof ANSI, s: string): string {
  return style.color ? `\u001b[${ANSI[code]}m${s}\u001b[0m` : s;
}

/** Longest separator under the last (unpadded) column. */
export const LAST_RULE_MAX = 40;

/** Plain-text table. Cells may already contain ANSI codes: pass `plain` widths separately. */
function table(headers: string[], rows: { cells: string[]; plain: string[] }[]): string {
  const widths = headers.map((h, i) => Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r.plain[i] ?? ""))));
  const line = (cells: string[], plain: string[]): string =>
    cells
      .map((c, i) => c + " ".repeat(Math.max(0, (widths[i] as number) - displayWidth(plain[i] ?? ""))))
      .join("  ")
      .trimEnd();
  // 마지막 칸은 채움 공백이 없으니 구분선을 길게 그을 필요가 없다: 긴 메시지가 있어도 터미널에서 줄이 넘어가지 않게 자른다
  const last = widths.length - 1;
  const ruleWidths = widths.map((w, i) => (i === last ? Math.max(displayWidth(headers[i] ?? ""), Math.min(w, LAST_RULE_MAX)) : w));
  const out = [line(headers, headers), ruleWidths.map((w) => "-".repeat(w)).join("  ")];
  for (const r of rows) out.push(line(r.cells, r.plain));
  return out.join("\n");
}

function plainRows(rows: string[][]): { cells: string[]; plain: string[] }[] {
  return rows.map((r) => ({ cells: r, plain: r }));
}

export function findingText(lang: Lang, f: Finding): string {
  return t(lang, findingKey(f.id, f.params), f.params);
}

function findingJson(lang: Lang, f: Finding): Record<string, unknown> {
  return { id: f.id, severity: f.severity, agent: f.agent, source: f.source, message: findingText(lang, f), params: f.params };
}

function agentLabel(lang: Lang, agent: string): string {
  const spec = AGENTS[agent as keyof typeof AGENTS];
  return spec.experimental ? `${agent} (${t(lang, "agent.experimental")})` : agent;
}

function verdictWord(lang: Lang, d: Decision | null): string {
  return t(lang, d === null ? "verdict.skip" : (`verdict.${d}` as MessageKey));
}

export function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// ---------------------------------------------------------------- list

function entryJson(e: HookEntry): Record<string, unknown> {
  return {
    agent: e.agent,
    event: e.event,
    matcher: e.matcher ?? null,
    type: e.type,
    command: e.command ?? null,
    if: e.ifRule ?? null,
    timeoutSec: e.timeoutSec,
    timeoutRaw: e.timeoutRaw,
    onFailure: e.onFailure ?? null,
    source: e.source,
    file: e.file,
    scope: e.scope,
    experimental: e.experimental,
  };
}

export function listJson(dir: string, entries: readonly HookEntry[]): string {
  return json({ dir, count: entries.length, hooks: entries.map(entryJson) });
}

export function listText(style: Style, dir: string, entries: readonly HookEntry[], home: string | undefined): string {
  const { lang } = style;
  if (entries.length === 0) return t(lang, "list.none", { dir });
  const headers = (["col.agent", "col.event", "col.matcher", "col.type", "col.command", "col.timeout", "col.if", "col.source"] as MessageKey[]).map((k) => t(lang, k));
  const rows = entries.map((e) => [
    agentLabel(lang, e.agent),
    e.event,
    e.matcher === undefined ? "*" : e.matcher === "" ? '""' : e.matcher,
    e.type,
    e.command ?? "-",
    e.timeoutSec === null ? "-" : String(e.timeoutSec),
    e.ifRule ?? "-",
    e.source,
  ]);
  const lines = [table(headers, plainRows(rows)), "", t(lang, "list.count", { count: entries.length })];
  if (home) lines.push(t(lang, "list.user", { home }));
  return lines.join("\n");
}

// ---------------------------------------------------------------- match

function hitJson(h: Hit): Record<string, unknown> {
  return {
    agent: h.entry.agent,
    event: h.entry.event,
    matcher: h.entry.matcher ?? null,
    matchKind: h.matchKind,
    type: h.entry.type,
    command: h.entry.command ?? null,
    if: h.entry.ifRule ?? null,
    ifResult: h.ifResult,
    runnable: h.runnable,
    timeoutSec: h.entry.timeoutSec,
    source: h.entry.source,
  };
}

export function matchJson(tool: string, input: Record<string, unknown>, matches: readonly AgentMatch[]): string {
  return json({
    tool,
    input,
    agents: matches.map((m) => ({
      agent: m.agent,
      experimental: AGENTS[m.agent].experimental,
      toolName: m.toolName,
      supported: m.toolName !== null,
      hitCount: m.hits.length,
      hits: m.hits.map(hitJson),
      filtered: m.filtered.map(hitJson),
    })),
  });
}

export function matchText(style: Style, tool: string, matches: readonly AgentMatch[]): string {
  const { lang } = style;
  if (matches.length === 0) return t(lang, "match.none");
  const blocks: string[] = [];
  for (const m of matches) {
    if (m.toolName === null) {
      blocks.push(t(lang, "match.noTool", { agent: agentLabel(lang, m.agent) }));
      continue;
    }
    const head = paint(style, "bold", t(lang, "match.header", { agent: agentLabel(lang, m.agent), tool: m.toolName, count: m.hits.length }));
    const lines = [head];
    if (m.hits.length > 0) {
      const headers = (["col.matcher", "col.how", "col.if", "col.command"] as MessageKey[]).map((k) => t(lang, k));
      const rows = m.hits.map((h) => [
        h.entry.matcher === undefined ? "*" : h.entry.matcher,
        t(lang, `matchKind.${h.matchKind}` as MessageKey),
        t(lang, `if.${h.ifResult}` as MessageKey),
        h.runnable ? (h.entry.command ?? "-") : t(lang, "match.notRunnable", { type: h.entry.type }),
      ]);
      lines.push(table(headers, plainRows(rows)));
    }
    if (m.filtered.length > 0) lines.push(t(lang, "match.filtered", { count: m.filtered.length }));
    blocks.push(lines.join("\n"));
  }
  void tool;
  return blocks.join("\n\n");
}

// ---------------------------------------------------------------- run

/** Which verdicts to highlight when agents disagree: the rarest, preferring "allow" on a tie. */
export function highlightedVerdicts(report: RunReport): Set<Decision> {
  if (!report.divergent) return new Set();
  const counts = new Map<Decision, number>();
  for (const v of Object.values(report.verdicts)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const min = Math.min(...counts.values());
  const rarest = [...counts.entries()].filter(([, c]) => c === min).map(([d]) => d);
  return new Set(rarest.length > 1 && rarest.includes("allow") ? (["allow"] as Decision[]) : rarest);
}

function outcomeJson(lang: Lang, o: HookOutcome): Record<string, unknown> {
  return {
    source: o.hit.entry.source,
    matcher: o.hit.entry.matcher ?? null,
    command: o.hit.entry.command ?? null,
    type: o.hit.entry.type,
    executed: o.run !== undefined,
    timeoutSec: o.run?.timeoutSec ?? o.hit.entry.timeoutSec,
    capped: o.run?.capped ?? false,
    exitCode: o.run?.code ?? null,
    timedOut: o.run?.timedOut ?? false,
    ms: o.run?.ms ?? null,
    stdout: o.run?.stdout.trim() ?? null,
    stderr: o.run?.stderr.trim() ?? null,
    decision: o.decision,
    reason: o.reason ?? null,
    findings: o.findings.map((f) => findingJson(lang, f)),
  };
}

export function resultJson(lang: Lang, tool: string, input: Record<string, unknown>, report: RunReport): string {
  return json({
    tool,
    input,
    divergent: report.divergent,
    verdicts: report.verdicts,
    results: report.results.map((r) => ({
      agent: r.agent,
      experimental: AGENTS[r.agent].experimental,
      toolName: r.toolName,
      verdict: r.verdict,
      reason: r.reason ?? null,
      findings: r.findings.map((f) => findingJson(lang, f)),
      hooks: r.hooks.map((h) => outcomeJson(lang, h)),
    })),
  });
}

export function planText(lang: Lang, matches: readonly AgentMatch[]): string {
  const runnable = matches.flatMap((m) => m.hits.filter((h) => h.runnable).map((h) => `  [${m.agent}] ${h.entry.command ?? ""}   (${h.entry.source})`));
  if (runnable.length === 0) return t(lang, "run.planNone");
  return [t(lang, "run.plan", { count: runnable.length }), ...runnable].join("\n");
}

function colorVerdict(style: Style, d: Decision | null, text: string): string {
  if (d === "block") return paint(style, "green", text);
  if (d === "allow") return paint(style, "yellow", text);
  if (d === "ask") return paint(style, "dim", text);
  return paint(style, "dim", text);
}

function findingIds(findings: readonly Finding[]): string {
  return [...new Set(findings.map((f) => f.id))].join(", ") || "-";
}

export function resultText(style: Style, report: RunReport): string {
  const { lang } = style;
  const highlight = highlightedVerdicts(report);
  const headers = (["col.agent", "col.tool", "col.verdict", "col.hooks", "col.findings"] as MessageKey[]).map((k) => t(lang, k));
  const rows = report.results.map((r: AgentResult) => {
    const word = verdictWord(lang, r.verdict);
    const marked = r.verdict !== null && highlight.has(r.verdict);
    const verdictPlain = marked ? `${word}  <--` : word;
    const verdictCell = marked ? paint(style, "red", paint(style, "bold", verdictPlain)) : colorVerdict(style, r.verdict, word);
    const plain = [agentLabel(lang, r.agent), r.toolName ?? "-", verdictPlain, String(r.hooks.length), findingIds(r.findings)];
    return { cells: [plain[0] as string, plain[1] as string, verdictCell, plain[3] as string, plain[4] as string], plain };
  });
  const lines = [table(headers, rows), ""];

  for (const r of report.results) {
    for (const h of r.hooks) {
      if (!h.run) continue;
      const capped = h.run.capped ? ` (${t(lang, "run.capped", { sec: h.run.timeoutSec })})` : "";
      lines.push(
        t(lang, h.run.timedOut ? "run.hookLineTimeout" : "run.hookLine", {
          agent: r.agent,
          command: h.hit.entry.command ?? "",
          // 신호로 끝나면 code 가 null: "null" 대신 신호 이름(SIGTERM 등)을 보여 준다
          code: h.run.code === null ? (h.run.signal ?? "?") : String(h.run.code),
          sec: h.run.timeoutSec,
          ms: h.run.ms,
          decision: verdictWord(lang, h.decision),
        }) + capped,
      );
    }
  }
  const all = report.results.flatMap((r) => r.findings);
  if (all.length > 0) {
    lines.push("");
    for (const f of all) lines.push(`[${f.id}] ${f.agent ?? ""}: ${findingText(lang, f)}`);
  }
  lines.push("");
  if (report.divergent) {
    const verdicts = Object.entries(report.verdicts).map(([a, v]) => `${a}=${verdictWord(lang, v)}`).join(", ");
    lines.push(paint(style, "red", t(lang, "run.divergent", { verdicts })));
  } else {
    const first = Object.values(report.verdicts)[0] ?? null;
    lines.push(t(lang, "run.same", { verdict: verdictWord(lang, first) }));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- test

export interface FileCases {
  file: string;
  cases: CaseResult[];
}

export function testJson(lang: Lang, files: readonly FileCases[]): string {
  const all = files.flatMap((f) => f.cases);
  const mismatches = all.flatMap((c) => c.mismatches);
  return json({
    total: all.length,
    passed: all.filter((c) => c.mismatches.length === 0).length,
    mismatchCount: mismatches.length,
    files: files.map((f) => ({
      file: f.file,
      cases: f.cases.map((c) => ({
        name: c.name,
        tool: c.tool,
        ok: c.mismatches.length === 0,
        checks: c.checks,
        mismatches: c.mismatches.map((m) => ({ ...m, findings: m.findings.map((x) => findingJson(lang, x)) })),
      })),
    })),
  });
}

export function testText(style: Style, files: readonly FileCases[]): string {
  const { lang } = style;
  const lines: string[] = [];
  const all = files.flatMap((f) => f.cases);
  for (const c of all) {
    if (c.mismatches.length === 0) {
      lines.push(paint(style, "green", t(lang, "test.ok", { name: c.name })));
      continue;
    }
    lines.push(paint(style, "red", t(lang, "test.fail", { name: c.name })));
    for (const m of c.mismatches) {
      lines.push(t(lang, "test.mismatch", { agent: m.agent, expected: verdictWord(lang, m.expected), got: verdictWord(lang, m.got) }));
      for (const f of m.findings) lines.push(`        [${f.id}] ${findingText(lang, f)}`);
    }
  }
  const mismatches = all.reduce((n, c) => n + c.mismatches.length, 0);
  lines.push("", t(lang, "test.summary", { passed: all.filter((c) => c.mismatches.length === 0).length, total: all.length, mismatches }));
  return lines.join("\n");
}

// ---------------------------------------------------------------- lint

export function countBySeverity(findings: readonly Finding[]): { error: number; warn: number; info: number } {
  const c = { error: 0, warn: 0, info: 0 };
  for (const f of findings) c[f.severity] += 1;
  return c;
}

export function lintJson(lang: Lang, findings: readonly Finding[]): string {
  return json({ counts: countBySeverity(findings), findings: findings.map((f) => findingJson(lang, f)) });
}

export function lintText(style: Style, findings: readonly Finding[]): string {
  const { lang } = style;
  if (findings.length === 0) return t(lang, "lint.none");
  const headers = (["col.severity", "col.id", "col.agent", "col.source", "col.message"] as MessageKey[]).map((k) => t(lang, k));
  const rows = findings.map((f) => {
    // 심각도 칸은 언어별 낱말(오류/경고/정보), 원래 값(error/warn/info)은 --json 에만 남긴다
    const word = t(lang, `severity.${f.severity}` as MessageKey);
    const plain = [word, f.id, f.agent ?? "-", f.source ?? "-", findingText(lang, f)];
    const sev = f.severity === "error" ? paint(style, "red", word) : f.severity === "warn" ? paint(style, "yellow", word) : paint(style, "dim", word);
    return { cells: [sev, ...plain.slice(1)], plain };
  });
  const c = countBySeverity(findings);
  return [table(headers, rows), "", t(lang, "lint.summary", { total: findings.length, errors: c.error, warns: c.warn, infos: c.info })].join("\n");
}
