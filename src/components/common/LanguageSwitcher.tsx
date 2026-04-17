"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n";

const LOCALE_KEY = "sb_locale";

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<SupportedLocale>("en");

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY) as SupportedLocale | null;
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
      setLocale(stored);
    }
  }, []);

  const handleSelect = (code: SupportedLocale) => {
    setLocale(code);
    localStorage.setItem(LOCALE_KEY, code);
    // Reload so server components re-render with new locale
    window.location.reload();
  };

  const current = SUPPORTED_LOCALES.find((l) => l.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          aria-label="Switch language"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{current?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => handleSelect(l.code)}
            className={locale === l.code ? "font-semibold" : ""}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
