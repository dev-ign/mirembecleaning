import { useRef, useState, type ReactNode } from 'react'
import { Header, Footer } from '../landing/LandingPage'
import { WaitlistModal } from '../landing/WaitlistModal'
import { CleaningTeamProvider } from '../CleaningTeamLink'
import { AnalyticsConsent } from '../AnalyticsConsent'
import { trackEvent } from '../../lib/analytics'
import { ZenMaidEmbed } from './ZenMaidEmbed'

function BookingLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [joined, setJoined] = useState(false)
  const [feedback, setFeedback] = useState('')
  const trigger = useRef<HTMLElement | null>(null)
  function open() {
    trigger.current = document.activeElement as HTMLElement
    setMenuOpen(false)
    trackEvent('waitlist_cta_click')
    setWaitlistOpen(true)
  }
  function dismiss() {
    setWaitlistOpen(false)
    window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <CleaningTeamProvider><div className="landing-page booking-page">
    <Header homePath="/" open={open} joined={joined} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
    <main id="booking-main">{children}</main>
    <Footer homePath="/" />
    <AnalyticsConsent />
    <WaitlistModal open={waitlistOpen} onDismiss={dismiss} onCreated={() => setJoined(true)} onFeedback={message => setFeedback(message)} />
    {feedback && <div className="landing-toast is-error" role="alert"><p>{feedback}</p><button type="button" aria-label="Dismiss notification" onClick={() => setFeedback('')}>×</button></div>}
  </div></CleaningTeamProvider>
}

export function BookingPage() {
  return <BookingLayout><div className="landing-container booking-content">
    <header className="booking-intro">
      <p className="landing-eyebrow">A little more peace this season</p>
      <h1>Book Your <em>Holiday Cleaning</em></h1>
      <p>Give yourself one less thing to worry about this holiday season. Complete the form below to request your cleaning, and our team will follow up to confirm the details.</p>
      <p className="booking-trust"><span aria-hidden="true">✓</span> All Mirembe cleaners are background-checked, insured, and bonded.</p>
    </header>
    <ZenMaidEmbed />
  </div></BookingLayout>
}

export function BookingThankYouPage() {
  return <BookingLayout><div className="landing-container booking-thank-you">
    <span className="booking-check" aria-hidden="true">✓</span>
    <p className="landing-eyebrow">Request received</p>
    <h1>Thank You!<br /><span>Your Cleaning Request Has Been Received.</span></h1>
    <p>We’ve received your booking request. Our team will review the details and contact you to confirm availability and your appointment.</p>
    <p>We look forward to helping you enjoy a cleaner home and a little more peace.</p>
    <a className="landing-button" href="/">Back to Home</a>
  </div></BookingLayout>
}
