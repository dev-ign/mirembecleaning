import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { holidayCampaign, holidayCtaDismissedKey, readCampaignFlag, writeCampaignFlag } from '../../config/campaigns'
import { useHydrated } from '../../lib/useHydrated'

function safeSessionStorage(): Storage | undefined { try { return window.sessionStorage } catch { return undefined } }

export function HolidayFloatingCTA({ hidden, onBooking }: { hidden: boolean; onBooking: () => void }) {
  const ready = useHydrated()
  const [dismissed, setDismissed] = useState(() => readCampaignFlag(safeSessionStorage(), holidayCtaDismissedKey))
  const [compact, setCompact] = useState(false)
  const [lifted, setLifted] = useState(false)

  useEffect(() => {
    const update = () => setCompact(window.innerWidth <= 360 || window.scrollY > 600)
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => setLifted(entries.some(entry => entry.isIntersecting)), { rootMargin: '0px 0px 120px 0px' })
    const observed = new Set<Element>()
    const sync = () => {
      document.querySelectorAll('.landing-footer, .analytics-consent-panel').forEach(element => {
        if (!observed.has(element)) { observed.add(element); observer.observe(element) }
      })
    }
    sync()
    const mutation = new MutationObserver(sync)
    mutation.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); mutation.disconnect() }
  }, [])

  if (!ready || hidden || dismissed || !holidayCampaign.floatingCtaEnabled) return null
  return <div className={`holiday-floating-cta${compact ? ' is-compact' : ''}${lifted ? ' is-lifted' : ''}`}>
    <a href={holidayCampaign.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={onBooking} aria-label={`Book a holiday cleaning, ${holidayCampaign.discount} off (opens in a new tab)`}>
      <img src="/landing/v2/holiday_calendar.svg" alt="" width="24" height="24" />
      <span className="holiday-floating-copy"><strong>Holiday Cleaning</strong><small>Save {holidayCampaign.discount} · Limited Dates</small></span>
      <span className="holiday-floating-arrow" aria-hidden="true">↗</span>
    </a>
    <button type="button" aria-label="Dismiss holiday cleaning promotion" onClick={() => { writeCampaignFlag(safeSessionStorage(), holidayCtaDismissedKey); setDismissed(true) }}>×</button>
  </div>
}

export function HolidayPromoModal({ open, onDismiss, onBooking }: { open: boolean; onDismiss: () => void; onBooking: () => void }) {
  const ready = useHydrated()
  const ref = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    previousFocus.current = document.activeElement as HTMLElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLButtonElement>('.holiday-modal-close')?.focus({ preventScroll: true })
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = overflow; window.requestAnimationFrame(() => previousFocus.current?.focus({ preventScroll: true })) }
  }, [open])
  function backdropClick(event: MouseEvent<HTMLDialogElement>) { if (event.target === event.currentTarget) onDismiss() }
  if (!ready) return null
  return createPortal(<dialog ref={ref} className="holiday-modal" aria-modal="true" aria-labelledby="holiday-modal-heading" onCancel={onDismiss} onClick={backdropClick}>
    <div className="holiday-modal-grid">
      <div className="holiday-modal-content">
        <button className="holiday-modal-close" type="button" aria-label="Close holiday cleaning promotion" onClick={onDismiss}>×</button>
        <p className="landing-overline">Limited holiday availability</p>
        <h2 id="holiday-modal-heading">Holiday Cleaning <em>Is Here.</em></h2>
        <p>Hosting this season? Let us handle the cleaning so you can focus on everything else.</p>
        <p>Get your home ready before guests arrive, or enjoy a fresh reset after the celebrations.</p>
        <div className="holiday-modal-offer">{holidayCampaign.discount} Off Holiday Cleanings</div>
        <p className="holiday-modal-dates-label">Holiday booking windows</p>
        <div className="holiday-modal-dates">{holidayCampaign.windows.map(window => { const [month, ...dates] = window.split(' '); return <span key={window}><strong>{month}</strong>{dates.join(' ')}</span> })}</div>
        <div className="holiday-modal-actions"><a className="landing-button" href={holidayCampaign.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={onBooking}>Request a Holiday Cleaning <span aria-hidden="true">↗</span></a><button type="button" className="landing-text-link" onClick={onDismiss}>Maybe Later</button></div>
        <small>Limited appointments available. Book early to secure your preferred date — open times are confirmed at booking.</small>
      </div>
      <figure className="holiday-modal-photo"><img src="/landing/v2/holiday_photo.webp" alt="A couple sharing coffee in a bright, freshly cleaned kitchen" width="1448" height="1086" /><figcaption>Ready before the guests arrive</figcaption></figure>
    </div>
  </dialog>, document.body)
}
