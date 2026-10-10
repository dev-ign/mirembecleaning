import { useEffect, useRef, useState, type AnimationEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import calendarIcon from '../../assets/icons/hiring-calendar.svg'
import closeIcon from '../../assets/icons/hiring-close.svg'
import locationIcon from '../../assets/icons/hiring-location.svg'
import { HiringApplicationForm } from './HiringApplicationForm'
import { HiringSuccess } from './HiringSuccess'
import type { HiringApplicationRecord } from '../../types/hiring'

interface HiringModalProps {
  open: boolean
  onDismiss: () => void
}

export function HiringModal({ open, onDismiss }: HiringModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimer = useRef<number | null>(null)
  const closing = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const [submittedApplication, setSubmittedApplication] = useState<HiringApplicationRecord | null>(null)
  const [stage, setStage] = useState<'form' | 'exiting' | 'success'>('form')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return

    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLHeadingElement>('#hiring-heading, #hiring-success-heading')?.focus({ preventScroll: true })

    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  function finishDismissal() {
    dialogRef.current?.close()
    if (submittedApplication && stage === 'exiting') setStage('success')
    closing.current = false
    setIsClosing(false)
    onDismiss()
  }

  function handleAccepted(record: HiringApplicationRecord) {
    setSubmittedApplication(record)
    setStage(!dialogRef.current?.open || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'success' : 'exiting')
  }

  function handleFormExitEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && stage === 'exiting') setStage('success')
  }

  function requestDismissal() {
    if (closing.current) return
    closing.current = true

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishDismissal()
      return
    }

    setIsClosing(true)
    closeTimer.current = window.setTimeout(finishDismissal, 200)
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      requestDismissal()
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
    ))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return createPortal(
    <dialog
      id="hiring-dialog"
      ref={dialogRef}
      className={'hiring-dialog' + (stage === 'success' ? ' is-success' : '') + (isClosing ? ' is-closing' : '')}
      aria-modal="true"
      aria-labelledby={stage === 'success' ? 'hiring-success-heading' : 'hiring-heading'}
      aria-describedby={stage === 'success' ? 'hiring-success-description' : 'hiring-description'}
      onCancel={(event) => { event.preventDefault(); requestDismissal() }}
      onClick={handleBackdropClick}
      onKeyDown={handleDialogKeyDown}
    >
      {stage === 'success' && submittedApplication ? <HiringSuccess onClose={requestDismissal} /> : (
      <div className={'hiring-surface' + (stage === 'exiting' ? ' is-exiting' : '')} onAnimationEnd={handleFormExitEnd}>
        <header className="hiring-header">
          <button className="hiring-close" type="button" aria-label="Close application form" onClick={requestDismissal}>
            <img src={closeIcon} width="24" height="24" alt="" aria-hidden="true" />
          </button>
          <h2 id="hiring-heading" tabIndex={-1}>Join the Mirembe team.</h2>
          <p id="hiring-description">Help us bring a little more peace to homes across Connecticut and Massachusetts</p>
          <div className="hiring-badges" aria-label="Hiring location and launch">
            <span className="hiring-badge"><img src={locationIcon} width="18" height="18" alt="" aria-hidden="true" />CT + MA</span>
            <span className="hiring-badge"><img src={calendarIcon} alt="" aria-hidden="true" />January 2027 launch</span>
          </div>
        </header>
        <HiringApplicationForm onAccepted={handleAccepted} />
      </div>
      )}
    </dialog>,
    document.body,
  )
}
