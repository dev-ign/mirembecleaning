import { useLocalizedHref } from '../../i18n/useLocalizedHref'
import { t, Trans, formatDateRange, useLocale } from '../../i18n'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { holidayCampaign, holidayCtaDismissedKey, readCampaignFlag, writeCampaignFlag } from '../../config/campaigns'
import { useHydrated } from '../../lib/useHydrated'
import { bookingConfig } from '../../config/booking'
import { trackBookingCTA } from '../../lib/optionalEvents'

function safeSessionStorage(): Storage | undefined { try { return window.sessionStorage } catch { return undefined } }

export function HolidayFloatingCTA({ hidden, onBooking }: { hidden: boolean; onBooking: () => void }) {
  const localHref = useLocalizedHref()
  useLocale()
  const ready = useHydrated()
  const [dismissed, setDismissed] = useState(() => readCampaignFlag(safeSessionStorage(), holidayCtaDismissedKey))
  const [compact, setCompact] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const [conversionActionsVisible, setConversionActionsVisible] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const update = () => setCompact(window.innerWidth <= 360 || window.scrollY > 600)
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    // Visible booking/waitlist actions take priority over the floating promotion.
    const visible = new Set<Element>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }
      setConversionActionsVisible(visible.size > 0)
    }, { rootMargin: '16px' })
    document.querySelectorAll('.landing-hero-actions, .landing-how .landing-cta-group, .landing-final-cta .landing-cta-group, .landing-services-request, .landing-area-prompt').forEach(actions => observer.observe(actions))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    // Yield the floating space instead of lifting over footer links.
    const observer = new IntersectionObserver(entries => setFooterVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: '0px 0px 16px 0px' })
    const footer = document.querySelector('.landing-footer')
    if (footer) observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const update = () => setEditing(Boolean(document.activeElement?.closest('form') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')))
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    window.visualViewport?.addEventListener('resize', update)
    update()
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  if (!ready || hidden || dismissed || footerVisible || conversionActionsVisible || editing || !holidayCampaign.floatingCtaEnabled) return null
  return <div className={`holiday-floating-cta${compact ? ' is-compact' : ''}`}>
    <a href={localHref(bookingConfig.path)} onClick={() => { trackBookingCTA('holiday_floating'); onBooking() }} aria-label={t('holiday.bookLabel', { discount: holidayCampaign.discount })}>
      <span className="holiday-floating-icon"><img src="/landing/v2/holiday_floating_calendar.svg" alt="" width="20" height="20" /></span>
      <span className="holiday-floating-copy"><strong className="holiday-floating-title">{t('holiday.name')}</strong><small>{t('holiday.saveDates', { discount: holidayCampaign.discount })}</small><strong className="holiday-floating-mobile-title">{t(compact ? 'holiday.discount' : 'holiday.mobileTitle', { discount: holidayCampaign.discount })}</strong></span>
      <picture className="holiday-floating-arrow"><source media="(max-width: 767px)" srcSet="/landing/v2/holiday_floating_arrow_mobile.svg" /><img src="/landing/v2/holiday_floating_arrow.svg" alt="" width="20" height="20" /></picture>
    </a>
    <span className="holiday-floating-divider" aria-hidden="true" />
    <button type="button" aria-label={t('holiday.dismiss')} onClick={() => { writeCampaignFlag(safeSessionStorage(), holidayCtaDismissedKey); setDismissed(true) }}><img src="/landing/v2/holiday_floating_close.svg" alt="" width="16" height="16" /></button>
  </div>
}

export function HolidayPromoModal({ open, onDismiss, onBooking }: { open: boolean; onDismiss: () => void; onBooking: () => void }) {
  const localHref = useLocalizedHref()
  useLocale()
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
      <div className="holiday-modal-main">
        <div className="holiday-modal-content">
          <p className="landing-overline">{t('holiday.eyebrow')}</p>
          <h2 id="holiday-modal-heading"><Trans i18nKey="holiday.title" components={{ accent: <em /> }} /></h2>
          <p>{t('holiday.hosting')}</p>
          <p>{t('holiday.reset')}</p>
          <div className="holiday-modal-offer"><img src="/landing/icons/leaf.svg" alt="" width="24" height="24" />{t('holiday.offer', { discount: holidayCampaign.discount })}</div>
          <p className="holiday-modal-dates-label">{t('holiday.windows')}</p>
          <div className="holiday-modal-dates">{holidayCampaign.dateRanges.map(([start, end]) => <span key={start}><img src="/landing/v2/holiday_calendar.svg" alt="" width="24" height="24" /><span>{formatDateRange(start, end)}</span></span>)}</div>
        </div>
        <div className="holiday-modal-footer"><div className="holiday-modal-actions"><a className="landing-button" href={localHref(bookingConfig.path)} onClick={() => { trackBookingCTA('holiday_modal'); onBooking() }}>{t('holiday.request')}<span aria-hidden="true">→</span></a><button type="button" className="landing-button is-secondary" onClick={onDismiss}>{t('holiday.later')}</button></div><small>{t('holiday.limited')}</small></div>
      </div>
      <figure className="holiday-modal-photo"><img src="/landing/v2/holiday_photo.webp" alt={t('holiday.photoAlt')} width="1448" height="1086" /><figcaption><img src="/landing/icons/leaf.svg" alt="" width="16" height="16" />{t('holiday.caption')}</figcaption></figure>
    </div>
    <button className="holiday-modal-close" type="button" aria-label={t('holiday.close')} onClick={onDismiss}>×</button>
  </dialog>, document.body)
}
