import { t, useLocale } from '../i18n'
import { useEffect, useRef } from 'react'
import type { WaitlistRecord } from '../types/waitlist'
import { AnimatedSuccessIcon } from './AnimatedSuccessIcon'
import { ZipCodeForm } from './ZipCodeForm'

interface WaitlistSuccessProps {
  record: WaitlistRecord
  onRecordUpdated: (record: WaitlistRecord) => void
}

export function WaitlistSuccess({ record, onRecordUpdated }: WaitlistSuccessProps) {
  useLocale()
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
            <h2 className="success-heading" ref={headingRef} tabIndex={-1}>{t('waitlist.successTitle')}</h2>
            <p className="success-subtitle">{t('waitlist.successSubtitle')}</p>
          </div>
        </div>
        <p className="success-message">
          {t('waitlist.successMessage')}</p>
      </div>
      <ZipCodeForm record={record} onSaved={onRecordUpdated} />
    </div>
  )
}
