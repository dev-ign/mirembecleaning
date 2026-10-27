import { createContext, useContext, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import arrowIcon from '../assets/icons/arrow-right.svg'
import { HiringModal } from './hiring/HiringModal'
import { trackEvent } from '../lib/optionalEvents'

const HiringContext = createContext<{ modalOpen: boolean; open: (event: MouseEvent<HTMLButtonElement>) => void } | null>(null)

export function CleaningTeamProvider({ children }: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function open(event: MouseEvent<HTMLButtonElement>) {
    triggerRef.current = event.currentTarget
    trackEvent('hiring_cta_click')
    setModalOpen(true)
  }

  return <HiringContext.Provider value={{ modalOpen, open }}>
    {children}
    <HiringModal open={modalOpen} onDismiss={() => {
      setModalOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    }} />
  </HiringContext.Provider>
}

export function CleaningTeamLink({ variant = 'footer' }: { variant?: 'footer' | 'hero' }) {
  const hiring = useContext(HiringContext)
  if (!hiring) throw new Error('CleaningTeamLink requires CleaningTeamProvider')
  const hero = variant === 'hero'

  return (
    <div className={hero ? 'landing-hero-hiring' : 'team-link-wrap entrance'} style={hero ? undefined : { animationDelay: '560ms' }}>
      <button
        className={hero ? 'landing-hiring-link' : 'team-link'}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={hiring.modalOpen}
        aria-controls="hiring-dialog"
        onClick={hiring.open}
      >
        <span>{hero ? <>Looking for cleaning work? <strong>Join our team</strong></> : 'Interested in joining our cleaning team?'}</span>
        <img src={arrowIcon} width="24" height="24" alt="" aria-hidden="true" />
      </button>
    </div>
  )
}
