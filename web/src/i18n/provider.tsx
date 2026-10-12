"use client";

import { useLayoutEffect } from "react";

import type { Locale } from "./config";
import { setI18n } from "./t";

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Record<string, string>;
  children: React.ReactNode;
}) {
  // Set before children render so t() sees this locale during the same pass.
  setI18n(locale, messages);

  useLayoutEffect(() => {
    setI18n(locale, messages);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
  }, [locale, messages]);

  return children;
}
