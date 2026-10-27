import { useEffect, useState } from 'react'
import { browserOptedOut, getConsent, hasConfiguredProvider, setConsent, startAnalytics, stopAnalytics } from '../lib/analytics'
import { consentChanged, consentKey } from '../lib/analytics/consent'
import { marketing } from '../config/marketing'
import { privacyConfig } from '../config/legal'
import { useHydrated } from '../lib/useHydrated'

export function AnalyticsConsent() {
  const ready = useHydrated()
  const [, refreshChoice] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const enabled = hasConfiguredProvider()
  const choice = ready ? getConsent() : null

  useEffect(() => {
    const update = () => {
      if (getConsent() !== 'accepted') stopAnalytics()
      refreshChoice(value => value + 1)
    }
    const storage = (event: StorageEvent) => { if (event.key === consentKey || event.key === null) update() }
    window.addEventListener(consentChanged, update)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener(consentChanged, update); window.removeEventListener('storage', storage) }
  }, [])

  useEffect(() => {
    if (choice === 'accepted') startAnalytics()
  }, [choice])

  if (!enabled || !ready) return null

  function choose(value: 'accepted' | 'declined') {
    setConsent(value)
    refreshChoice(choice => choice + 1)
    setShowSettings(false)
  }

  return (
    <div className="analytics-consent" aria-label="Tracking preferences">
      {choice && !showSettings ? (
        <button type="button" className="analytics-settings" onClick={() => setShowSettings(true)}>Tracking preferences</button>
      ) : (
        <div className="analytics-consent-panel" role="group" aria-label="Optional tracking choice">
          {browserOptedOut() ? (
            <>
              <p>Your browser privacy setting blocks optional tracking.</p>
              <button type="button" onClick={() => setShowSettings(false)}>Close</button>
            </>
          ) : (
            <>
              <p>May we use optional analytics{marketing.metaPixelId ? ' and advertising cookies' : ''} to understand visits, booking interest, and waitlist signups? Forms work either way.</p>
              <p><a href={privacyConfig.path} target="_blank" rel="noopener noreferrer">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a></p>
              <div className="analytics-consent-actions">
                <button type="button" onClick={() => choose('declined')}>Decline</button>
                <button type="button" onClick={() => choose('accepted')}>Allow tracking</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
