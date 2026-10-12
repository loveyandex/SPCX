"use client";

import { usePathname, useRouter } from "next/navigation";

import { LOCALE_COOKIE, type Locale } from "./config";
import { localePath, stripLocale } from "./t";

export function useSwitchLocale() {
  const pathname = usePathname();
  const router = useRouter();
  const current = (pathname.match(/^\/(en|fa)(?=\/|$)/)?.[1] ?? "en") as Locale;

  function switchLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const bare = stripLocale(pathname || "/");
    const search = typeof window === "undefined" ? "" : window.location.search;
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    router.push(`${localePath(bare, next)}${search}${hash}`);
  }

  return { current, switchLocale };
}
