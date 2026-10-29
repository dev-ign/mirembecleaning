import { useLocalizedHref } from '../../i18n/useLocalizedHref'
import { t, useLocale } from '../../i18n'
import { useEffect, useRef, useState } from 'react'
import { bookingConfig } from '../../config/booking'
import { useHydrated } from '../../lib/useHydrated'
import { loadZenMaid } from '../../lib/zenmaid'
import { business } from '../../config/business'
import { setBookingFormVisible, trackEvent } from '../../lib/optionalEvents'

export function ZenMaidEmbed() {
  const localHref = useLocalizedHref()
  const locale = useLocale()
  const hydrated = useHydrated()
  const basic = hydrated && new URLSearchParams(window.location.search).get('embed') === 'basic'
  const container = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'pending' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const element = container.current
    if (!hydrated || basic || !element) return
    let active = true
    // Observe the mounted container; do not alter any vendor-generated markup.
    const isRendered = () => Boolean(element.querySelector('form input:not([type="hidden"]), form select, form button'))
    const check = () => { if (isRendered()) setStatus('ready') }
    const observer = new MutationObserver(check)
    observer.observe(element, { childList: true, subtree: true })
    check()
    void loadZenMaid().then(() => {
      if (active) setStatus(isRendered() ? 'ready' : 'pending')
    }, () => { if (active) setStatus('error') })
    // The vendor owns its DOM, listeners and globals for this document's life.
    // Strict Mode cleanup disconnects only our observer, never the vendor form.
    return () => { active = false; observer.disconnect() }
  }, [hydrated, basic])

  useEffect(() => {
    const surface = basic ? frame.current : container.current
    if (!hydrated || status !== 'ready' || !surface || !('IntersectionObserver' in window)) return
    // Visibility is a funnel metric only. Neither this nor the readiness
    // observer above is ever used as submission/redirect evidence.
    const observer = new IntersectionObserver(entries => {
      setBookingFormVisible(entries.some(entry => entry.isIntersecting))
    }, { threshold: 0.1 })
    observer.observe(surface)
    return () => { observer.disconnect(); setBookingFormVisible(false) }
  }, [hydrated, basic, status])

  return <section className={`booking-embed is-${basic ? 'basic' : status}`} aria-label={t('booking.formRegion')}>
    {basic ? <>
      <p className="booking-status">{t('booking.simpleHelp')}</p>
      <iframe ref={frame} className="booking-basic-frame" src={bookingConfig.holiday.basicEmbedUrl} title={t('booking.frameTitle')} onLoad={() => setStatus('ready')} />
    </> : <>
      {status !== 'ready' && <p className="booking-status" role="status">
        {status === 'loading' ? t('booking.loading') : status === 'error'
          ? t('booking.loadError')
          : t('booking.pending')}
      </p>}
      <div ref={container} lang="en" className="zenmaid-container" />
    </>}
    <div className="booking-provider-help">
      {locale !== 'en' && <p>{t('booking.vendorNotice')}</p>}
      <p>{t('booking.help')}{' '}<a href={business.phoneHref} onClick={() => trackEvent('phone_click')}>{t('booking.call', { phone: business.phoneDisplay })}</a></p>
      <div><span>{t('booking.trouble')}</span>
        <a href={bookingConfig.holiday.hostedUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('booking_fallback_click')}>{t('booking.secure')}<span aria-hidden="true">↗</span><span className="sr-only"> {t('common.newTab')}</span></a>
        <details><summary>{t('booking.more')}</summary>
          {!basic ? <a href={localHref(`${bookingConfig.path}?embed=basic`)} onClick={() => trackEvent('booking_fallback_click')}>{t('booking.simple')}</a>
            : <a href={localHref(bookingConfig.path)} onClick={() => trackEvent('booking_fallback_click')}>{t('booking.full')}</a>}
        </details>
      </div>
    </div>
  </section>
}
