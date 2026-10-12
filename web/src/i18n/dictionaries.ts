import type { Locale } from "./config";

const dictionaries: Record<Locale, () => Promise<Record<string, string>>> = {
  en: () => import("./messages/en.json").then((module) => module.default),
  fa: () => import("./messages/fa.json").then((module) => module.default),
};

export async function getDictionary(locale: Locale): Promise<Record<string, string>> {
  return dictionaries[locale]();
}
