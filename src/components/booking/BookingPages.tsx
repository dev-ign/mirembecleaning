import { SiteDocumentLayout } from '../SiteDocumentLayout'
import { ZenMaidEmbed } from './ZenMaidEmbed'
import { termsConfig } from '../../config/legal'
import { trackEvent } from '../../lib/analytics'

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
  return <SiteDocumentLayout><div className="landing-container booking-thank-you">
    <span className="booking-check" aria-hidden="true">✓</span>
    <p className="landing-eyebrow">Request received</p>
    <h1>Thank You!<br /><span>Your Cleaning Request Has Been Received.</span></h1>
    <p>We’ve received your booking request. Our team will review the details and contact you to confirm availability and your appointment.</p>
    <p>We look forward to helping you enjoy a cleaner home and a little more peace.</p>
    <a className="landing-button" href="/">Back to Home</a>
  </div></SiteDocumentLayout>
}
