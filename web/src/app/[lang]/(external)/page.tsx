import { redirect } from "next/navigation";

import { hasLocale } from "@/i18n/config";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(hasLocale(lang) ? `/${lang}/function/tasks` : "/en/function/tasks");
}
