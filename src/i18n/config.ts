export const locales = {
  en: { label: 'English', shortLabel: 'EN', htmlLang: 'en', pathPrefix: '', hreflang: 'en', flag: '🇺🇸' },
  es: { label: 'Español', shortLabel: 'ES', htmlLang: 'es', pathPrefix: '/es', hreflang: 'es', flag: '🇪🇸' },
  ht: { label: 'Kreyòl Ayisyen', shortLabel: 'HT', htmlLang: 'ht', pathPrefix: '/ht', hreflang: 'ht', flag: '🇭🇹' },
  pt: { label: 'Português', shortLabel: 'PT', htmlLang: 'pt-BR', pathPrefix: '/pt', hreflang: 'pt-BR', flag: '🇧🇷' },
} as const
export type SupportedLocale = keyof typeof locales
export const localeCodes = Object.keys(locales) as SupportedLocale[]
export const languageStorageKey = 'mirembe:language:v1'
export const bookingLanguageStorageKey = 'mirembe:booking-language:v1'
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && Object.hasOwn(locales, value)
}
export function readSavedLocale(): SupportedLocale {
  try { const value = localStorage.getItem(languageStorageKey); return isSupportedLocale(value) ? value : 'en' } catch { return 'en' }
}
