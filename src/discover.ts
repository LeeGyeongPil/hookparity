import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { AGENTS } from "./agents/index.js";
import { ALL_AGENTS, ConfigError, readError, syntaxError, type AgentId, type HookEntry } from "./model.js";

export interface DiscoverOptions {
  /** Project directory to scan. */
  dir: string;
  /** User home to scan too (`--user` / `--home`). Never written to. */
  home?: string;
  /** Agents to scan; defaults to all four. */
  agents?: readonly AgentId[];
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readConfigFile(file: string): unknown {
  let text: string;
  try {
    text = readFileSync(file, "utf8"); // read-only access
  } catch (err) {
    throw readError(file, err);
  }
  try {
    if (file.endsWith(".toml")) return parseToml(text);
    return JSON.parse(text);
  } catch (err) {
    // 파서의 영어 문장 대신 줄·열 번호만 메시지 키로 넘긴다(한국어 출력에 영어가 섞이지 않게)
    throw syntaxError(file, text, err);
  }
}

interface FileCtx {
  agent: AgentId;
  file: string;
  source: string;
  scope: "project" | "user";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function handlerToEntry(ctx: FileCtx, event: string, matcher: string | undefined, groupIndex: number, h: Obj): HookEntry {
  const raw = num(h["timeout"]);
  const spec = AGENTS[ctx.agent];
  return {
    agent: ctx.agent,
    event,
    matcher,
    type: typeof h["type"] === "string" ? h["type"] : "command",
    command: typeof h["command"] === "string" ? h["command"] : undefined,
    ifRule: typeof h["if"] === "string" ? h["if"] : undefined,
    timeoutRaw: raw,
    // 에이전트 표의 단위(timeoutUnit)로 초 단위 정규화: Gemini 는 밀리초라 1000 으로 나눈다
    timeoutSec: raw === null ? null : spec.timeoutUnit === "milliseconds" ? raw / 1000 : raw,
    onFailure: typeof h["onFailure"] === "string" ? h["onFailure"] : undefined,
    source: ctx.source,
    file: ctx.file,
    scope: ctx.scope,
    experimental: spec.experimental,
    groupIndex,
  };
}

/** `event -> [ {matcher, hooks:[handler]} ]` as used by Claude Code, Codex and Gemini. */
function entriesFromEvents(ctx: FileCtx, hooks: Obj, out: HookEntry[]): void {
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    groups.forEach((group, groupIndex) => {
      if (!isObj(group)) return;
      const matcher = typeof group["matcher"] === "string" ? group["matcher"] : undefined;
      const handlers = group["hooks"];
      if (Array.isArray(handlers)) {
        for (const h of handlers) if (isObj(h)) out.push(handlerToEntry(ctx, event, matcher, groupIndex, h));
      } else if (typeof group["command"] === "string" || typeof group["type"] === "string") {
        out.push(handlerToEntry(ctx, event, matcher, groupIndex, group)); // handler written without a group
      }
    });
  }
}

/** Antigravity: top-level key = hook name, then event. Parsed leniently (experimental). */
function entriesFromAntigravity(ctx: FileCtx, root: Obj, out: HookEntry[]): void {
  const base = isObj(root["hooks"]) ? root["hooks"] : root;
  const events = AGENTS.antigravity.events;
  const direct: Obj = {};
  for (const [key, value] of Object.entries(base)) {
    if (events.includes(key) && Array.isArray(value)) {
      direct[key] = value; // events at the top level
    } else if (isObj(value)) {
      for (const [event, body] of Object.entries(value)) {
        const items = Array.isArray(body) ? body : [body];
        const groups = items.filter(isObj).map((item) => (Array.isArray(item["hooks"]) ? item : { matcher: item["matcher"], hooks: [item] }));
        entriesFromEvents(ctx, { [event]: groups }, out);
      }
    }
  }
  entriesFromEvents(ctx, direct, out);
}

function parseFile(ctx: FileCtx): HookEntry[] {
  const root = readConfigFile(ctx.file);
  if (!isObj(root)) throw new ConfigError(ctx.file, "config.notObject");
  const out: HookEntry[] = [];
  if (ctx.agent === "antigravity") {
    entriesFromAntigravity(ctx, root, out);
    return out;
  }
  const hooks = isObj(root["hooks"]) ? root["hooks"] : ctx.file.endsWith("hooks.json") ? root : undefined;
  if (hooks) entriesFromEvents(ctx, hooks, out);
  return out;
}

/** Discover hooks of every selected agent in the project dir and (optionally) the user home. */
export function discover(opts: DiscoverOptions): HookEntry[] {
  const agents = opts.agents ?? ALL_AGENTS;
  const dir = resolve(opts.dir);
  const entries: HookEntry[] = [];
  const scan = (base: string, scope: "project" | "user"): void => {
    for (const id of agents) {
      const spec = AGENTS[id];
      for (const rel of scope === "project" ? spec.projectFiles : spec.userFiles) {
        const file = join(base, rel);
        if (!existsSync(file) || !statSync(file).isFile()) continue;
        const source = scope === "project" ? rel : `~/${rel}`;
        entries.push(...parseFile({ agent: id, file, source, scope }));
      }
    }
  };
  scan(dir, "project");
  if (opts.home) scan(resolve(opts.home), "user");
  return entries;
}

/** Candidate user-level config files of experimental agents that exist under `home`. */
export function userCandidates(home: string, agent: AgentId): string[] {
  return AGENTS[agent].userFiles.map((rel) => join(resolve(home), rel)).filter((f) => existsSync(f));
}
