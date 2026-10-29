import type { MessageKey } from '../../i18n'
import { t, useLocale } from '../../i18n'
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { WaitlistExperience } from '../WaitlistExperience'
import { useHydrated } from '../../lib/useHydrated'
import type { WaitlistRecord } from '../../types/waitlist'

interface Props {
  open: boolean
  onDismiss: () => void
  onCreated: (record: WaitlistRecord) => void
  onFeedback: (message: MessageKey, kind: 'error' | 'verification') => void
}

export function WaitlistModal({ open, onDismiss, onCreated, onFeedback }: Props) {
  useLocale()
  const ready = useHydrated()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const [complete, setComplete] = useState(false)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLElement>('#waitlist-dialog-heading')?.focus({ preventScroll: true })
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = overflow }
  }, [open])
  function dismiss() { if (!submitting.current) onDismiss() }
  function backdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss()
  }
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]'))
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  if (!ready) return null
  return createPortal(<dialog ref={dialogRef} className="waitlist-dialog" aria-modal="true" aria-labelledby="waitlist-dialog-heading" aria-describedby="waitlist-dialog-description"
    onCancel={(event) => { if (submitting.current) event.preventDefault(); else onDismiss() }} onClick={backdropClick} onKeyDown={trapFocus}>
    <div className="waitlist-dialog-inner">
      <button className="waitlist-dialog-close" type="button" aria-label={t('waitlist.close')} onClick={dismiss}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5 15 15M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
      <p className="landing-eyebrow">{t('waitlist.eyebrow')}</p>
      <h2 id="waitlist-dialog-heading" tabIndex={-1}>{complete ? t('waitlist.successTitle') : t('waitlist.title')}</h2>
      <p id="waitlist-dialog-description">{complete ? t('waitlist.zipPrompt') : t('waitlist.intro')}</p>
      {open && <WaitlistExperience onCreated={(record) => { setComplete(true); onCreated(record) }} onFeedback={onFeedback} onSubmittingChange={(value) => { submitting.current = value }} />}
    </div>
  </dialog>, document.body)
}
