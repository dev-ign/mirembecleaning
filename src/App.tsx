import { SiteRouteContext } from './i18n/RouteContext'
import { useRoutePath, routeChanged } from './i18n/navigation'
import { resolveSiteRoute, canonicalRedirect } from './i18n/routes'
import { NotFoundPage } from './components/NotFoundPage'
import { useEffect } from 'react'
import { LandingPage } from './components/landing/LandingPage'
import { BookingPage, BookingThankYouPage } from './components/booking/BookingPages'
import { TermsPage } from './components/legal/TermsPage'
import { PrivacyPage } from './components/legal/PrivacyPage'
import { privacyConfig, termsConfig } from './config/legal'
import { allowsPromotionalOverlays } from './config/campaigns'
import { bookingConfig } from './config/booking'
import { LocaleEffects } from './i18n/LocaleEffects'
import { prepareOptionalEvents, startAnalytics } from './lib/optionalEvents'

export default function App({ path }: { path?: string }) {
  const pathname = useRoutePath(path)
  const resolved = resolveSiteRoute(pathname)
  const route = resolved.basePath
  // Child consent effects can dispatch before App's passive startup effect.

  useEffect(() => {
    const redirect = canonicalRedirect(window.location.pathname)
    if (redirect) {
      window.history.replaceState(window.history.state, '', redirect + window.location.search + window.location.hash)
      window.dispatchEvent(new Event(routeChanged))
    }
    prepareOptionalEvents()
    startAnalytics()
  }, [pathname])
  const page = !resolved.found ? <NotFoundPage /> : route === bookingConfig.thankYouPath ? <BookingThankYouPage />
    : route === '/booking' ? <BookingPage />
    : route === termsConfig.path ? <TermsPage />
    : route === privacyConfig.path ? <PrivacyPage />
    : <LandingPage key={route} promotionsAllowed={allowsPromotionalOverlays(pathname)} />
  return <SiteRouteContext.Provider value={resolved}><LocaleEffects route={pathname} />{page}</SiteRouteContext.Provider>
}
