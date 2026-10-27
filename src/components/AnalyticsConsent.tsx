import { useEffect, useRef, useState } from 'react'
import { setConsent, startAnalytics, stopAnalytics } from '../lib/optionalEvents'
import { browserOptedOut, getConsent, hasConfiguredProvider, consentChanged, consentKey, consentPersistenceFailed } from '../lib/consent'
import { marketing } from '../config/marketing'
import { privacyConfig } from '../config/legal'
import { useHydrated } from '../lib/useHydrated'

const openPreferences = 'mirembe:open-tracking-preferences'

export function TrackingPreferencesButton() {
  return <button type="button" aria-haspopup="dialog" onClick={event => {
    event.currentTarget.focus({ preventScroll: true })
    window.dispatchEvent(new Event(openPreferences))
  }}>Tracking preferences</button>
}

export function AnalyticsConsent() {
  const ready = useHydrated()
  const [, refreshChoice] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const enabled = hasConfiguredProvider()
  const choice = ready ? getConsent() : null

  useEffect(() => {
    const update = () => {
      if (getConsent() !== 'accepted') stopAnalytics()
      refreshChoice(value => value + 1)
    }
    const open = () => setShowSettings(true)
    window.addEventListener(openPreferences, open)
    const storage = (event: StorageEvent) => { if (event.key === consentKey || event.key === null) update() }
    window.addEventListener(consentChanged, update)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener(openPreferences, open); window.removeEventListener(consentChanged, update); window.removeEventListener('storage', storage) }
  }, [])

  useEffect(() => {
    if (choice === 'accepted') startAnalytics()
  }, [choice])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!showSettings || !dialog) return
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLButtonElement>('[data-close-preferences]')?.focus({ preventScroll: true })
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = overflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [showSettings])

  if (!ready || (!enabled && !showSettings)) return null

  function choose(value: 'accepted' | 'declined') {
    setConsent(value)
    refreshChoice(choice => choice + 1)
    setShowSettings(consentPersistenceFailed())
  }

  if (choice && !showSettings) return null

  const controls = <>
    {!enabled ? <p>Optional tracking is not enabled for this site.</p> : browserOptedOut() ? (
      <p>Your browser privacy setting blocks optional tracking.</p>
    ) : (
      <>
        {showSettings && <p>Optional tracking is currently <strong>{choice === 'accepted' ? 'allowed' : choice === 'declined' ? 'declined' : 'not selected'}</strong>.{choice === 'accepted' ? ' Decline to withdraw your consent.' : ''}</p>}
        <p>May we use optional analytics{marketing.metaPixelId ? ' and advertising cookies' : ''} to understand visits, booking interest, and waitlist signups? Forms work either way.</p>
      </>
    )}
    {consentPersistenceFailed() && <p role="alert">Your choice applies to this page only. It could not be saved and may reset when you reload.</p>}
    <p><a href={privacyConfig.path} target="_blank" rel="noopener noreferrer">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a></p>
    {enabled && !browserOptedOut() && <div className="analytics-consent-actions">
      <button type="button" onClick={() => choose('declined')}>Decline</button>
      <button type="button" onClick={() => choose('accepted')}>Allow tracking</button>
    </div>}
  </>

  if (showSettings) return <dialog ref={dialogRef} className="analytics-preferences-dialog analytics-consent-panel" aria-modal="true" aria-labelledby="tracking-preferences-heading" onCancel={() => setShowSettings(false)} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]'))
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <div className="analytics-preferences-heading"><h2 id="tracking-preferences-heading">Tracking preferences</h2><button type="button" data-close-preferences aria-label="Close tracking preferences" onClick={() => setShowSettings(false)}>×</button></div>
    {controls}
  </dialog>

  return <div className="analytics-consent" aria-label="Tracking preferences">
    <div className="analytics-consent-panel" role="group" aria-label="Optional tracking choice">{controls}</div>
  </div>
}
