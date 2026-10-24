import { LandingPage } from './components/landing/LandingPage'
import { BookingPage, BookingThankYouPage } from './components/booking/BookingPages'

export default function App({ path = '/' }: { path?: string }) {
  const route = path.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/'
  if (route === '/booking/thank-you') return <BookingThankYouPage />
  if (route === '/booking') return <BookingPage />
  return <LandingPage />
}
