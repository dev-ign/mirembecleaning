import i18next from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'
import ht from './locales/ht.json'
import pt from './locales/pt.json'
import { locales, type SupportedLocale } from './config'
export { Trans } from 'react-i18next'
import type { MessageKey, TranslationKey } from './messages'
export type { TranslationKey, MessageKey } from './messages'
// All resources are local and ready synchronously; SSR always starts in English.
export const resources = { en, es, ht, pt } satisfies Record<SupportedLocale, Record<TranslationKey, string>>
export const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(resources).map(([code, translation]) => [code, { translation }])),
  lng: 'en', fallbackLng: 'en', supportedLngs: Object.keys(locales),
  initAsync: false, keySeparator: false,
  interpolation: { escapeValue: false }, react: { useSuspense: false },
})
/** Also accepts state-held message keys. Unknown external messages are never rendered. */
export function t(key: MessageKey, values?: Record<string, unknown>): string {
  return Object.hasOwn(en, key) ? String(i18n.t(key, values)) : ''
}
export function useLocale() {
  const { i18n: instance } = useTranslation(undefined, { i18n })
  return instance.resolvedLanguage as SupportedLocale
}
export function formatDateRange(start: string, end: string): string {
  const locale = (i18n.resolvedLanguage ?? 'en') as SupportedLocale
  // Intl engines commonly lack Haitian Creole data and silently return English.
  // Use native Kreyòl month names rather than French or an English fallback.
  if (locale === 'ht') {
    const months = ['dates.months.january', 'dates.months.february', 'dates.months.march', 'dates.months.april', 'dates.months.may', 'dates.months.june', 'dates.months.july', 'dates.months.august', 'dates.months.september', 'dates.months.october', 'dates.months.november', 'dates.months.december'] as const
    const first = new Date(start + 'T12:00:00Z'), last = new Date(end + 'T12:00:00Z')
    const format = (date: Date) => t('dates.creoleDate', { day: date.getUTCDate(), month: t(months[date.getUTCMonth()]), year: date.getUTCFullYear() })
    if (first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear()) return t('dates.creoleRange', { start: first.getUTCDate(), end: last.getUTCDate(), month: t(months[first.getUTCMonth()]), year: first.getUTCFullYear() })
    return t('dates.creoleFullRange', { start: format(first), end: format(last) })
  }
  const language = locales[locale].htmlLang
  return new Intl.DateTimeFormat(language, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .formatRange(new Date(start + 'T12:00:00Z'), new Date(end + 'T12:00:00Z'))
}
