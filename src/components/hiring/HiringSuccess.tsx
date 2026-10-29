import { t, useLocale } from '../../i18n'
import { useEffect, useRef } from 'react'
import closeIcon from '../../assets/icons/hiring-close.svg'
import successIcon from '../../assets/icons/hiring-success.svg'

interface HiringSuccessProps {
  onClose: () => void
}

export function HiringSuccess({ onClose }: HiringSuccessProps) {
  useLocale()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (headingRef.current?.closest('dialog')?.open) headingRef.current.focus({ preventScroll: true })
  }, [])

  return (
    <div className="hiring-success">
      <button className="hiring-close hiring-success-x" type="button" aria-label={t('hiring.closeConfirmation')} onClick={onClose}>
        <img src={closeIcon} width="24" height="24" alt="" aria-hidden="true" />
      </button>
      <div className="hiring-success-copy">
        <div className="hiring-success-intro">
          <img className="hiring-success-icon" src={successIcon} width="127" height="127" alt="" aria-hidden="true" />
          <h2 id="hiring-success-heading" ref={headingRef} tabIndex={-1}>{t('hiring.successTitle')}</h2>
        </div>
        <p id="hiring-success-description">{t('hiring.successMessage')}</p>
      </div>
      <button className="hiring-success-close" type="button" onClick={onClose}>{t('common.close')}</button>
    </div>
  )
}
