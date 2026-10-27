import { useEffect, useRef } from 'react'
import { SiteDocumentLayout } from '../SiteDocumentLayout'
import { ZenMaidEmbed } from './ZenMaidEmbed'
import { termsConfig } from '../../config/legal'
import { trackEvent } from '../../lib/optionalEvents'

export function BookingPage() {
  return <SiteDocumentLayout><div className="landing-container booking-content">
    <header className="booking-intro">
      <p className="landing-eyebrow">A little more peace this season</p>
      <h1>Book Your <em>Holiday Cleaning</em></h1>
      <p>Request your holiday cleaning below. Our team will follow up to confirm the details.</p>
      <div className="booking-reassurance">
        <p className="booking-trust"><span aria-hidden="true">✓</span> All Mirembe cleaners are background-checked, insured, and bonded.</p>
        <p className="booking-terms">Review our <a href={termsConfig.path} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('booking_terms_click')}>Terms of Service<span className="sr-only"> (opens in a new tab)</span></a> before booking.</p>
      </div>
    </header>
    <ZenMaidEmbed />
  </div></SiteDocumentLayout>
}

export function BookingThankYouPage() {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  return <SiteDocumentLayout><div className="landing-container booking-thank-you">
    <span className="booking-check" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="m11 20 6 6 12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
    <p className="landing-eyebrow">A little more peace of mind</p>
    <h1 ref={heading} tabIndex={-1}>Your Cleaning<br /> <em>Request Is In</em></h1>
    <p>Thank you for choosing Mirembe Cleaning. We’ve received your request, and our team will reach out to confirm the details.</p>
    <p>We look forward to helping you enjoy a cleaner home and a little more peace.</p>
    <div className="booking-thank-you-actions"><a className="landing-button" href="/">Back to Home</a><a className="landing-button is-secondary" href="/#services">Explore Our Services</a></div>
  </div></SiteDocumentLayout>
}
