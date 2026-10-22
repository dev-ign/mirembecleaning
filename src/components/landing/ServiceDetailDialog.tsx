import { useEffect, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useHydrated } from '../../lib/useHydrated'
import type { Service } from './content'

type Props = { service: Service | null; onDismiss: () => void; onRequest: () => void }

export function ServiceDetailDialog({ service, onDismiss, onRequest }: Props) {
  const ready = useHydrated()
  const ref = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!service || !dialog) return
    trigger.current = document.activeElement as HTMLElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLButtonElement>('.service-detail-close')?.focus({ preventScroll: true })
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = overflow
      window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
    }
  }, [service])

  function backdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onDismiss()
  }

  if (!ready) return null
  return createPortal(
    <dialog ref={ref} className="service-detail-dialog" aria-modal="true" aria-labelledby="service-detail-heading" onCancel={onDismiss} onClick={backdropClick}>
      {service && <div className="service-detail-inner">
        <div className="service-detail-top"><span className="landing-overline">Service details</span><button className="service-detail-close" type="button" onClick={onDismiss} aria-label="Close service details">×</button></div>
        <div className="service-detail-scroll">
          <h2 id="service-detail-heading">{service.title}</h2>
          <p className="service-detail-summary">{service.summary}</p>
          <h3>{service.lead}</h3>
          <ul className="service-detail-list">{service.items.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
          <div className="service-detail-addons"><h3>Available add-ons</h3><div>{service.addons.map(addon => <span className="landing-area-badge" key={addon}>{addon}</span>)}</div></div>
          <p className="service-detail-note">{service.note}</p>
        </div>
        <div className="service-detail-actions"><button className="landing-button" type="button" onClick={onRequest}>Request a Cleaning <span aria-hidden="true">→</span></button><button className="landing-text-link" type="button" onClick={onDismiss}>Back to services</button></div>
      </div>}
    </dialog>, document.body,
  )
}
