"use client";

import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/i18n/config";
import { useSwitchLocale } from "@/i18n/use-switch-locale";

const LABELS: Record<Locale, string> = {
  en: "English",
  fa: "فارسی",
};

export function LanguageSwitcher() {
  const { current, switchLocale } = useSwitchLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" aria-label="Language">
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((code) => (
          <DropdownMenuItem key={code} onClick={() => switchLocale(code)}>
            <span className="flex-1">{LABELS[code]}</span>
            {code === current ? <span aria-hidden="true">✓</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
