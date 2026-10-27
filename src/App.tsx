import { useEffect } from 'react'
import { LandingPage } from './components/landing/LandingPage'
import { BookingPage, BookingThankYouPage } from './components/booking/BookingPages'
import { TermsPage } from './components/legal/TermsPage'
import { PrivacyPage } from './components/legal/PrivacyPage'
import { privacyConfig, termsConfig } from './config/legal'
import { allowsPromotionalOverlays } from './config/campaigns'
import { bookingConfig } from './config/booking'
import { prepareOptionalEvents, startAnalytics } from './lib/optionalEvents'

export default function App({ path = '/' }: { path?: string }) {
  const route = path.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/'
  useEffect(() => {
    const actual = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '')
    if (actual === bookingConfig.legacyThankYouPath) {
      window.history.replaceState(window.history.state, '', bookingConfig.thankYouPath + window.location.search + window.location.hash)
    }
    prepareOptionalEvents()
    startAnalytics()
  }, [route])
  if (route === bookingConfig.thankYouPath || route === bookingConfig.legacyThankYouPath) return <BookingThankYouPage />
  if (route === '/booking') return <BookingPage />
  if (route === termsConfig.path) return <TermsPage />
  if (route === privacyConfig.path) return <PrivacyPage />
  return <LandingPage key={route} promotionsAllowed={allowsPromotionalOverlays(route)} />
}
