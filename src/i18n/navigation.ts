import { useSyncExternalStore } from 'react'
import { i18n } from './index'
import { localizedPath, resolveSiteRoute, type BasePath } from './routes'
import type { SupportedLocale } from './config'

export const routeChanged = 'mirembe:route-changed'
const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener)
  window.addEventListener(routeChanged, listener)
  return () => { window.removeEventListener('popstate', listener); window.removeEventListener(routeChanged, listener) }
}
export function useRoutePath(controlledPath?: string): string {
  const snapshot = () => controlledPath ?? window.location.pathname
  return useSyncExternalStore(subscribe, snapshot, () => controlledPath ?? (typeof window === 'undefined' ? '/' : window.location.pathname))
}
export function initializeRouteLocale(path: string): void {
  void i18n.changeLanguage(resolveSiteRoute(path).locale)
}

/** Only the language version changes; keep the mounted form, scroll, search and hash. */
export function navigateLocale(locale: SupportedLocale): void {
  const current = resolveSiteRoute(window.location.pathname)
  const destination = localizedPath(current.found ? current.basePath as BasePath : '/', locale) + window.location.search + window.location.hash
  void i18n.changeLanguage(locale)
  if (destination === window.location.pathname + window.location.search + window.location.hash) return
  window.history.pushState(window.history.state, '', destination)
  window.dispatchEvent(new Event(routeChanged))
}
