import { useCallback, useRef, useState, type FormEvent } from 'react'
import { privacyConfig } from '../../config/legal'
import { t, Trans, useLocale, type MessageKey } from '../../i18n'
import { useLocalizedHref } from '../../i18n/useLocalizedHref'
import { useHydrated } from '../../lib/useHydrated'
import { NewsletterRequestError, subscribeToNewsletter } from '../../services/newsletterService'
import { isValidEmail } from '../../shared/email'
import { TurnstileWidget, type TurnstileStatus, type TurnstileWidgetHandle } from '../TurnstileWidget'

export function NewsletterSignupSection() {
  const locale = useLocale()
  const hydrated = useHydrated()
  const localHref = useLocalizedHref()
  const [error, setError] = useState<MessageKey>('')
  const [requestError, setRequestError] = useState<MessageKey>('')
  const [state, setState] = useState<'idle' | 'submitting' | 'acknowledged' | 'error'>('idle')
  const [security, setSecurity] = useState<TurnstileStatus>('loading')
  const tokenRef = useRef('')
  const busyRef = useRef(false)
  const widgetRef = useRef<TurnstileWidgetHandle>(null)
  const onSecurityChange = useCallback((status: TurnstileStatus, token?: string) => {
    tokenRef.current = status === 'verified' ? token ?? '' : ''
    setSecurity(status)
  }, [])

  function validateEmail(input: HTMLInputElement) {
    const message = !input.value.trim() ? 'newsletter.emailRequired'
      : !isValidEmail(input.value) ? 'newsletter.emailInvalid' : ''
    setError(message)
    return !message
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current) return
    const input = event.currentTarget.elements.namedItem('email') as HTMLInputElement
    if (!validateEmail(input)) { input.focus(); return }
    if (!tokenRef.current) { setRequestError('newsletter.verificationError'); return }
    busyRef.current = true
    setState('submitting')
    setRequestError('')
    try {
      await subscribeToNewsletter(input.value, locale, tokenRef.current)
      tokenRef.current = ''
      setState('acknowledged')
    } catch (cause) {
      setState('error')
      setRequestError(cause instanceof NewsletterRequestError && cause.kind === 'verification' ? 'newsletter.verificationError'
        : cause instanceof NewsletterRequestError && cause.kind === 'rate_limited' ? 'newsletter.rateLimited'
        : cause instanceof NewsletterRequestError && cause.kind === 'invalid' ? 'newsletter.invalidRequest' : 'newsletter.requestError')
      busyRef.current = false
      tokenRef.current = ''
      widgetRef.current?.reset()
    }
  }

  const status: MessageKey = state === 'acknowledged' ? 'newsletter.acknowledged'
    : state === 'submitting' ? 'newsletter.submitting'
    : security === 'verified' ? 'newsletter.ready'
    : security === 'error' || security === 'expired' ? 'newsletter.verificationError' : 'newsletter.verifying'

  return <section className="landing-newsletter" aria-labelledby="newsletter-heading">
    <div className="landing-container">
      <div className="landing-newsletter-panel">
        <div className="landing-newsletter-content">
          <h2 id="newsletter-heading">{t('newsletter.title')}</h2>
          <p className="landing-newsletter-description">{t('newsletter.description')}</p>
          <form aria-labelledby="newsletter-heading" aria-describedby="newsletter-status newsletter-disclosure" aria-busy={state === 'submitting'} noValidate onSubmit={handleSubmit}>
            <label htmlFor="newsletter-email">{t('newsletter.emailLabel')}</label>
            <div className="landing-newsletter-controls">
              <div className="landing-newsletter-email">
                <input id="newsletter-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254}
                  placeholder={t('newsletter.emailPlaceholder')} aria-invalid={Boolean(error)}
                  readOnly={state === 'submitting' || state === 'acknowledged'}
                  aria-describedby={'newsletter-status newsletter-disclosure' + (error ? ' newsletter-email-error' : '')}
                  onBlur={event => validateEmail(event.currentTarget)} onChange={() => setError('')} />
                {error && <p id="newsletter-email-error" className="landing-newsletter-error" role="alert">{t(error)}</p>}
              </div>
              <button type="submit" className="landing-button is-primary" disabled={security !== 'verified' || state === 'submitting' || state === 'acknowledged'} aria-describedby="newsletter-status">{t(state === 'submitting' ? 'newsletter.submitting' : 'newsletter.subscribe')}</button>
            </div>
            {hydrated && state !== 'acknowledged' && <TurnstileWidget ref={widgetRef} action="newsletter" onStatusChange={onSecurityChange} />}
            <p id="newsletter-status" className="landing-newsletter-status" role="status" aria-live="polite">{t(status)}</p>
            {requestError && <p className="landing-newsletter-error" role="alert">{t(requestError)}</p>}
            {(security === 'error' || security === 'expired') && state !== 'acknowledged' && state !== 'submitting'
              && <button type="button" className="landing-newsletter-retry" onClick={() => { setRequestError(''); widgetRef.current?.reset() }}>{t('newsletter.retryVerification')}</button>}
            <p id="newsletter-disclosure" className="landing-newsletter-disclosure"><Trans i18nKey="newsletter.disclosure" components={{ privacy: <a href={localHref(privacyConfig.path)} /> }} /></p>
          </form>
        </div>
      </div>
    </div>
  </section>
}
