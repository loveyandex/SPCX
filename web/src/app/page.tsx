"use client";

import { useEffect } from "react";

import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

/** Fallback when the locale proxy is not running (static export). */
export default function RootRedirect() {
  useEffect(() => {
    const cookie = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=(en|fa)`))?.[1];
    const lang: Locale = cookie === "fa" ? "fa" : "en";
    window.location.replace(`/${lang}/function/tasks`);
  }, []);
  return null;
}
