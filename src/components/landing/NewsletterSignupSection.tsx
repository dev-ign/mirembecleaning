import { useState } from 'react'
import { privacyConfig } from '../../config/legal'
import { t, Trans, useLocale, type MessageKey } from '../../i18n'
import { useLocalizedHref } from '../../i18n/useLocalizedHref'

export function NewsletterSignupSection() {
  useLocale()
  const localHref = useLocalizedHref()
  const [error, setError] = useState<MessageKey>('')

  function validateEmail(input: HTMLInputElement) {
    setError(input.validity.valueMissing ? 'newsletter.emailRequired'
      : input.validity.typeMismatch ? 'newsletter.emailInvalid' : '')
  }

  return <section className="landing-newsletter" aria-labelledby="newsletter-heading">
    <div className="landing-container">
      <div className="landing-newsletter-panel">
        <div className="landing-newsletter-content">
          <h2 id="newsletter-heading">{t('newsletter.title')}</h2>
          <p className="landing-newsletter-description">{t('newsletter.description')}</p>
          <form aria-labelledby="newsletter-heading" aria-describedby="newsletter-status newsletter-disclosure" noValidate onSubmit={event => event.preventDefault()}>
            <label htmlFor="newsletter-email">{t('newsletter.emailLabel')}</label>
            <div className="landing-newsletter-controls">
              <div className="landing-newsletter-email">
                <input id="newsletter-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254}
                  placeholder={t('newsletter.emailPlaceholder')} aria-invalid={Boolean(error)}
                  aria-describedby={'newsletter-status newsletter-disclosure' + (error ? ' newsletter-email-error' : '')}
                  onBlur={event => validateEmail(event.currentTarget)} onChange={() => setError('')} />
                {error && <p id="newsletter-email-error" className="landing-newsletter-error" role="alert">{t(error)}</p>}
              </div>
              <button type="submit" className="landing-button is-primary" disabled aria-describedby="newsletter-status">{t('newsletter.subscribe')}</button>
            </div>
            <p id="newsletter-status" className="landing-newsletter-status">{t('newsletter.unavailable')}</p>
            <p id="newsletter-disclosure" className="landing-newsletter-disclosure"><Trans i18nKey="newsletter.disclosure" components={{ privacy: <a href={localHref(privacyConfig.path)} /> }} /></p>
          </form>
        </div>
      </div>
    </div>
  </section>
}
