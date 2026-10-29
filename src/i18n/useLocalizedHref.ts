import { useLocale } from './index'
import { localizeHref } from './routes'
export function useLocalizedHref() {
  const locale = useLocale()
  return (href: string) => localizeHref(href, locale)
}
