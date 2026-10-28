import { useLocalizedHref } from '../../i18n/useLocalizedHref'
import { t, Trans, useLocale } from '../../i18n'
import { useEffect, useRef } from 'react'
import { SiteDocumentLayout } from '../SiteDocumentLayout'
import { ZenMaidEmbed } from './ZenMaidEmbed'
import { termsConfig } from '../../config/legal'
import { trackEvent } from '../../lib/optionalEvents'

export function BookingPage() {
  const localHref = useLocalizedHref()
  useLocale()
  return <SiteDocumentLayout><div className="landing-container booking-content">
    <header className="booking-intro">
      <p className="landing-eyebrow">{t('booking.eyebrow')}</p>
      <h1><Trans i18nKey="booking.title" components={{ accent: <em /> }} /></h1>
      <p>{t('booking.intro')}</p>
      <div className="booking-reassurance">
        <p className="booking-trust"><span aria-hidden="true">✓</span> {t('common.cleanerTrust')}</p>
        <p className="booking-terms"><Trans i18nKey="booking.terms" components={{ terms: <a href={localHref(termsConfig.path)} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('booking_terms_click')} />, newTab: <span className="sr-only" /> }} /></p>
      </div>
    </header>
    <ZenMaidEmbed />
  </div></SiteDocumentLayout>
}

export function BookingThankYouPage() {
  const localHref = useLocalizedHref()
  useLocale()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  return <SiteDocumentLayout><div className="landing-container booking-thank-you">
    <span className="booking-check" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="m11 20 6 6 12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
    <p className="landing-eyebrow">{t('booking.thankYou.eyebrow')}</p>
    <h1 ref={heading} tabIndex={-1}><Trans i18nKey="booking.thankYou.title" components={{ br: <br />, accent: <em /> }} /></h1>
    <p>{t('booking.thankYou.message')}</p>
    <p>{t('booking.thankYou.welcome')}</p>
    <div className="booking-thank-you-actions"><a className="landing-button" href={localHref("/")}>{t('booking.home')}</a><a className="landing-button is-secondary" href={localHref("/#services")}>{t('booking.explore')}</a></div>
  </div></SiteDocumentLayout>
}
