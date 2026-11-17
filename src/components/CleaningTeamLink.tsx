import { t, useLocale } from '../i18n'
import { createContext, useContext, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import arrowIcon from '../assets/icons/arrow-right.svg'
import { HiringModal } from './hiring/HiringModal'
import { trackEvent } from '../lib/optionalEvents'

const HiringContext = createContext<{ modalOpen: boolean; open: (event: MouseEvent<HTMLButtonElement>, returnFocusTo?: HTMLButtonElement) => void } | null>(null)

export function CleaningTeamProvider({ children }: { children: ReactNode }) {
  useLocale()
  const [modalOpen, setModalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function open(event: MouseEvent<HTMLButtonElement>, returnFocusTo?: HTMLButtonElement) {
    triggerRef.current = returnFocusTo ?? event.currentTarget
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

export function CleaningTeamLink({ variant = 'footer', onNavigate, returnFocusRef }: { variant?: 'footer' | 'navigation'; onNavigate?: () => void; returnFocusRef?: RefObject<HTMLButtonElement | null> }) {
  useLocale()
  const hiring = useContext(HiringContext)
  if (!hiring) throw new Error('CleaningTeamLink requires CleaningTeamProvider')
  const navigation = variant === 'navigation'

  const button = (
    <button
      className={navigation ? 'landing-button is-secondary' : 'team-link'}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={hiring.modalOpen}
      aria-controls="hiring-dialog"
      onClick={event => { onNavigate?.(); hiring.open(event, returnFocusRef?.current ?? undefined) }}
    >
      <span>{t(navigation ? 'hiring.joinTeam' : 'hiring.link')}</span>
      {!navigation && <img src={arrowIcon} width="24" height="24" alt="" aria-hidden="true" />}
    </button>
  )
  return navigation ? button : <div className="team-link-wrap entrance" style={{ animationDelay: '560ms' }}>{button}</div>
}
