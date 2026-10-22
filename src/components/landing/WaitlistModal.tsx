import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { WaitlistExperience } from '../WaitlistExperience'
import { useHydrated } from '../../lib/useHydrated'
import type { WaitlistRecord } from '../../types/waitlist'

interface Props {
  open: boolean
  onDismiss: () => void
  onCreated: (record: WaitlistRecord) => void
  onFeedback: (message: string, kind: 'error' | 'verification') => void
}

export function WaitlistModal({ open, onDismiss, onCreated, onFeedback }: Props) {
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
      <button className="waitlist-dialog-close" type="button" aria-label="Close waitlist" onClick={dismiss}>×</button>
      <p className="landing-eyebrow">A little more peace is coming</p>
      <h2 id="waitlist-dialog-heading" tabIndex={-1}>{complete ? 'You’re on the list!' : 'Join the Mirembe waitlist.'}</h2>
      <p id="waitlist-dialog-description">{complete ? 'Thanks for joining us. Add your ZIP code so we know where to prioritize availability.' : 'Be the first to hear when new cleaning slots open in your area.'}</p>
      {open && <WaitlistExperience onCreated={(record) => { setComplete(true); onCreated(record) }} onFeedback={onFeedback} onSubmittingChange={(value) => { submitting.current = value }} />}
    </div>
  </dialog>, document.body)
}
