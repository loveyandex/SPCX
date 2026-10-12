import { notFound } from "next/navigation";

import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "fa" }];
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const messages = await getDictionary(lang as Locale);
  return (
    <I18nProvider locale={lang} messages={messages}>
      {children}
    </I18nProvider>
  );
}
