import en from '@/i18n/en.json'
import hi from '@/i18n/hi.json'

type Translations = typeof en

const translations: Record<string, Translations> = {
  en,
  hi,
}

export function t(key: string, locale: string = 'en'): string {
  const keys = key.split('.')
  let value: unknown = translations[locale] || translations.en
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return key
    }
  }
  
  return typeof value === 'string' ? value : key
}

export function getLocale(): string {
  // For now, default to English. In Phase 1, we'll add proper locale detection
  return 'en'
}
