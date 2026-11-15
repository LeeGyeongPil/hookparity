import { en, type MessageKey } from "./en.js";
import { ko } from "./ko.js";

export type Lang = "en" | "ko";
export type { MessageKey };

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, ko };

/** Parse a locale-like value. Anything starting with "ko" is Korean, everything else English. */
export function langFromLocale(value: string): Lang {
  return value.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/**
 * Language order: --lang flag, then HOOKPARITY_LANG, then LC_ALL, LC_MESSAGES, LANG
 * (the first one that is set and non-empty decides). Default English.
 */
export function resolveLang(flag: string | undefined, env: Record<string, string | undefined>): Lang {
  if (flag !== undefined) return langFromLocale(flag);
  for (const name of ["HOOKPARITY_LANG", "LC_ALL", "LC_MESSAGES", "LANG"]) {
    const v = env[name];
    if (v !== undefined && v !== "") return langFromLocale(v);
  }
  return "en";
}

/** Look up a message and fill `{name}` placeholders. */
export function t(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** Message key for a finding; HP002, HP005 and HP104 have variants. */
export function findingKey(id: string, params: Record<string, string | number>): MessageKey {
  let key = `finding.${id}`;
  if (id === "HP002") key = `finding.HP002.${String(params["kind"])}`;
  if (id === "HP005") key = `finding.HP005.${String(params["agentUnit"])}`;
  if (id === "HP102" && params["signal"] !== undefined) key = "finding.HP102.signal";
  if (id === "HP104") key = `finding.HP104.${String(params["outcome"])}`;
  return key as MessageKey;
}
