import { useEffect, useRef } from 'react'
import closeIcon from '../../assets/icons/hiring-close.svg'
import successIcon from '../../assets/icons/hiring-success.svg'

interface HiringSuccessProps {
  onClose: () => void
}

export function HiringSuccess({ onClose }: HiringSuccessProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (headingRef.current?.closest('dialog')?.open) headingRef.current.focus({ preventScroll: true })
  }, [])

  return (
    <div className="hiring-success">
      <button className="hiring-close hiring-success-x" type="button" aria-label="Close application confirmation" onClick={onClose}>
        <img src={closeIcon} width="24" height="24" alt="" aria-hidden="true" />
      </button>
      <div className="hiring-success-copy">
        <div className="hiring-success-intro">
          <img className="hiring-success-icon" src={successIcon} width="127" height="127" alt="" aria-hidden="true" />
          <h2 id="hiring-success-heading" ref={headingRef} tabIndex={-1}>We've received your application.</h2>
        </div>
        <p id="hiring-success-description">Thank you for your interest in joining the Mirembe team. We will review your application and someone from our team will be in touch soon!</p>
      </div>
      <button className="hiring-success-close" type="button" onClick={onClose}>Close</button>
    </div>
  )
}
