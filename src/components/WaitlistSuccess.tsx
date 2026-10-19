import { useEffect, useRef } from 'react'
import type { WaitlistRecord } from '../types/waitlist'
import { AnimatedSuccessIcon } from './AnimatedSuccessIcon'
import { ZipCodeForm } from './ZipCodeForm'

interface WaitlistSuccessProps {
  record: WaitlistRecord
  onRecordUpdated: (record: WaitlistRecord) => void
}

export function WaitlistSuccess({ record, onRecordUpdated }: WaitlistSuccessProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="waitlist-success-stage">
      <div className="success-confirmation">
        <div className="success-row">
          <AnimatedSuccessIcon />
          <div className="success-heading-group">
            <h2 className="success-heading" ref={headingRef} tabIndex={-1}>You’re on the list!</h2>
            <p className="success-subtitle">A little more peace is on its way.</p>
          </div>
        </div>
        <p className="success-message">
          We’ll be in touch when booking opens, along with your $50 recurring-clean offer.
        </p>
      </div>
      <ZipCodeForm record={record} onSaved={onRecordUpdated} />
    </div>
  )
}
