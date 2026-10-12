import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { defaultLocale, hasLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

const AUTH_PAGES = ["/login", "/setup"];

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && hasLocale(saved)) return saved;
  const header = request.headers.get("accept-language") ?? "";
  if (/(^|,)\s*fa\b/i.test(header)) return "fa";
  return defaultLocale;
}

function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const match = pathname.match(/^\/(en|fa)(?=\/|$)/);
  if (!match || !hasLocale(match[1])) return { locale: null, rest: pathname };
  const rest = pathname.slice(match[0].length) || "/";
  return { locale: match[1], rest };
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);

  if (!locale) {
    const nextLocale = preferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${nextLocale}` : `/${nextLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Mock demo: no real login. Locale prefix is still applied above.
  if (process.env.NEXT_PUBLIC_MOCK === "1") return NextResponse.next();

  const token = request.cookies.get("artex_token")?.value;
  const isAuthPage = AUTH_PAGES.some((page) => rest === page || rest.startsWith(`${page}/`));

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL(`/${locale}/function/tasks`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals, API routes, favicon, and static files in public/.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$).*)"],
};
