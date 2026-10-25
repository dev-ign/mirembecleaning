import { LandingPage } from './components/landing/LandingPage'
import { BookingPage, BookingThankYouPage } from './components/booking/BookingPages'
import { TermsPage } from './components/legal/TermsPage'
import { termsConfig } from './config/legal'
import { allowsPromotionalOverlays } from './config/campaigns'

export default function App({ path = '/' }: { path?: string }) {
  const route = path.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/'
  if (route === '/booking/thank-you') return <BookingThankYouPage />
  if (route === '/booking') return <BookingPage />
  if (route === termsConfig.path) return <TermsPage />
  return <LandingPage key={route} promotionsAllowed={allowsPromotionalOverlays(route)} />
}
