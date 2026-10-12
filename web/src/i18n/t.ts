import { defaultLocale, type Locale } from "./config";

export type Vars = Record<string, string | number | null | undefined>;

let locale: Locale = defaultLocale;
let messages: Record<string, string> = {};

export function getLocale(): Locale {
  return locale;
}

/** Called by the locale layout before children render. English keys fall through as-is. */
export function setI18n(next: Locale, nextMessages: Record<string, string>) {
  locale = next;
  messages = nextMessages;
}

export function t(message: string, vars?: Vars): string {
  let out = messages[message] ?? message;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      out = out.replaceAll(`{${key}}`, value == null ? "" : String(value));
    }
  }
  return out;
}

export function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/(en|fa)(?=\/|$)/);
  if (!match) return pathname || "/";
  const rest = pathname.slice(match[0].length);
  return rest.length > 0 ? rest : "/";
}

/** Prefix an in-app path with the active locale. Query strings and hashes are kept. */
export function localePath(path: string, loc: Locale = locale): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const cut = ["?", "#"].map((mark) => path.indexOf(mark)).filter((index) => index >= 0);
  const splitAt = cut.length > 0 ? Math.min(...cut) : path.length;
  const suffix = path.slice(splitAt);
  const bare = stripLocale(path.slice(0, splitAt) || "/");
  return (bare === "/" ? `/${loc}` : `/${loc}${bare}`) + suffix;
}
