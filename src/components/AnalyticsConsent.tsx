import { useEffect, useState } from 'react'
import { browserOptedOut, getConsent, hasConfiguredProvider, setConsent, startAnalytics } from '../lib/analytics'
import { marketing } from '../config/marketing'
import { useHydrated } from '../lib/useHydrated'

export function AnalyticsConsent() {
  const ready = useHydrated()
  const [choiceOverride, setChoiceOverride] = useState<'accepted' | 'declined' | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const enabled = hasConfiguredProvider()
  const choice = choiceOverride ?? (ready ? getConsent() : null)

  useEffect(() => {
    if (choice === 'accepted') startAnalytics()
  }, [choice])

  if (!enabled || !ready) return null

  function choose(value: 'accepted' | 'declined') {
    setConsent(value)
    setChoiceOverride(value)
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
              <p>May we use optional analytics{marketing.metaPixelId ? ' and advertising cookies' : ''} to understand visits and waitlist signups? Forms work either way.</p>
              <p><a href={marketing.privacyPolicyUrl}>Privacy Policy</a></p>
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
