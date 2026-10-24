import { useEffect, useRef, useState } from 'react'
import { bookingConfig } from '../../config/booking'
import { useHydrated } from '../../lib/useHydrated'
import { loadZenMaid } from '../../lib/zenmaid'

export function ZenMaidEmbed() {
  const hydrated = useHydrated()
  const basic = hydrated && new URLSearchParams(window.location.search).get('embed') === 'basic'
  const container = useRef<HTMLDivElement>(null)
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

  return <section className={`booking-embed is-${basic ? 'basic' : status}`} aria-label="Holiday cleaning booking form">
    <div className="booking-provider-help">
      <p>Having trouble loading the booking form? You can continue securely through our booking provider.</p>
      <div>
        {!basic && <a href={`${bookingConfig.path}?embed=basic`}>Try the simple form</a>}
        {basic && <a href={bookingConfig.path}>Use the full booking form</a>}
        <a href={bookingConfig.holiday.hostedUrl}>Continue to Booking <span aria-hidden="true">↗</span></a>
      </div>
    </div>
    {basic ? <>
      <p className="booking-status">The simple form may scroll within its frame. You can also continue through ZenMaid using the link above.</p>
      <iframe className="booking-basic-frame" src={bookingConfig.holiday.basicEmbedUrl} title="Mirembe Holiday Cleaning booking request form, powered by ZenMaid" />
    </> : <>
      {status !== 'ready' && <p className="booking-status" role="status">
        {status === 'loading' ? 'Loading your booking form…' : status === 'error'
          ? 'The booking form couldn’t load. Please try the simple form or continue through our booking provider above.'
          : 'Your booking form is being prepared. If it doesn’t appear, try the simple form or continue through our booking provider above.'}
      </p>}
      <div ref={container} className="zenmaid-container" />
    </>}
  </section>
}
