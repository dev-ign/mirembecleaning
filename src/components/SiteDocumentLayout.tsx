import { t, useLocale, type MessageKey } from '../i18n'
import { useRef, useState, type ReactNode } from 'react'
import { Header, Footer } from './landing/LandingPage'
import { WaitlistModal } from './landing/WaitlistModal'
import { CleaningTeamProvider } from './CleaningTeamLink'
import { AnalyticsConsent } from './AnalyticsConsent'
import { trackEvent } from '../lib/optionalEvents'

export function SiteDocumentLayout({ children, pageClass = 'booking-page', mainId = 'booking-main' }: { children: ReactNode; pageClass?: string; mainId?: string }) {
  useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [joined, setJoined] = useState(false)
  const [feedback, setFeedback] = useState<MessageKey>('')
  const trigger = useRef<HTMLElement | null>(null)
  function open() {
    trigger.current = document.activeElement as HTMLElement
    setMenuOpen(false)
    trackEvent('waitlist_cta_click')
    setWaitlistOpen(true)
  }
  function dismiss() {
    setWaitlistOpen(false)
    window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <CleaningTeamProvider><div className={`landing-page ${pageClass}`}>
    <Header homePath="/" open={open} joined={joined} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
    <main id={mainId}>{children}</main>
    <Footer homePath="/" />
    <AnalyticsConsent />
    <WaitlistModal open={waitlistOpen} onDismiss={dismiss} onCreated={() => setJoined(true)} onFeedback={message => setFeedback(message)} />
    {feedback && <div className="landing-toast is-error" role="alert"><p>{t(feedback)}</p><button type="button" aria-label={t('common.dismissNotification')} onClick={() => setFeedback('')}>×</button></div>}
  </div></CleaningTeamProvider>
}

