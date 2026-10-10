import { useRef, useState } from 'react'
import arrowIcon from '../assets/icons/arrow-right.svg'
import { HiringModal } from './hiring/HiringModal'

export function CleaningTeamLink() {
  const [modalOpen, setModalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="team-link-wrap entrance" style={{ animationDelay: '560ms' }}>
      <button
        ref={triggerRef}
        className="team-link"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
        aria-controls="hiring-dialog"
        onClick={() => setModalOpen(true)}
      >
        <span>Interested in joining our cleaning team?</span>
        <img src={arrowIcon} width="24" height="24" alt="" aria-hidden="true" />
      </button>
      <HiringModal open={modalOpen} onDismiss={() => {
        setModalOpen(false)
        triggerRef.current?.focus({ preventScroll: true })
      }} />
    </div>
  )
}
