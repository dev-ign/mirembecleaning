import { useLocalizedHref } from '../i18n/useLocalizedHref'
import { t, Trans, useLocale, type MessageKey } from '../i18n'
import { useCallback, useRef, useState, type AnimationEvent, type FormEvent } from 'react'
import mailIcon from '../assets/icons/mail.svg'
import { TurnstileWidget, type TurnstileStatus, type TurnstileWidgetHandle } from './TurnstileWidget'
import { createWaitlistEntry, WaitlistRequestError } from '../services/waitlistService'
import type { WaitlistRecord } from '../types/waitlist'
import { trackEvent } from '../lib/optionalEvents'
import { privacyConfig } from '../config/legal'

type FormStatus = 'idle' | 'invalid' | 'submitting' | 'error'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface WaitlistFormProps {
  onCreated: (record: WaitlistRecord) => void
  onFeedback?: (message: MessageKey, kind: 'error' | 'verification') => void
  onSubmittingChange?: (submitting: boolean) => void
  exiting: boolean
  onExitComplete: () => void
}

export function WaitlistForm({ onCreated, onFeedback, onSubmittingChange, exiting, onExitComplete }: WaitlistFormProps) {
  const localHref = useLocalizedHref()
  useLocale()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [message, setMessage] = useState<MessageKey>('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<TurnstileStatus>('loading')
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)
  const submitPending = useRef(false)
  const startTracked = useRef(false)
  const verificationErrorActive = useRef(false)
  const handleVerificationChange = useCallback((nextStatus: TurnstileStatus, token = '') => {
    setVerificationStatus(nextStatus)
    setTurnstileToken(token)
    if (nextStatus === 'error') {
      verificationErrorActive.current = true
      setStatus((current) => current === 'submitting' ? current : 'error')
      setMessage('errors.verificationLoad')
      onFeedback?.('errors.verificationLoad', 'verification')
    } else if (nextStatus === 'verified' && verificationErrorActive.current) {
      verificationErrorActive.current = false
      setStatus((current) => current === 'error' ? 'idle' : current)
      setMessage('')
    }
  }, [onFeedback])
  const verificationPending = verificationStatus === 'loading' || verificationStatus === 'ready'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitPending.current || exiting) return
    if (verificationStatus === 'error' || verificationStatus === 'expired') {
      verificationErrorActive.current = false
      setStatus('idle')
      setMessage('')
      turnstileRef.current?.reset()
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    setEmail(normalizedEmail)

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setStatus('invalid')
      setMessage('errors.waitlistEmail')
      return
    }
    if (verificationStatus !== 'verified' || !turnstileToken) return

    submitPending.current = true
    onSubmittingChange?.(true)
    trackEvent('waitlist_form_submit')
    setStatus('submitting')
    setMessage('')

    try {
      const record = await createWaitlistEntry({ email: normalizedEmail, source: 'landing_page' }, turnstileToken)
      if (record.id) trackEvent('waitlist_signup_success', record.id)
      onCreated(record)
    } catch (error) {
      trackEvent('waitlist_signup_error')
      submitPending.current = false
      onSubmittingChange?.(false)
      const invalid = error instanceof WaitlistRequestError && error.kind === 'invalid'
      const verification = error instanceof WaitlistRequestError && error.kind === 'verification'
      verificationErrorActive.current = verification
      setStatus(invalid ? 'invalid' : 'error')
      setMessage(invalid
        ? 'errors.waitlistEmail'
        : verification ? 'errors.verificationFailed'
        : 'errors.waitlistSubmit')
      onFeedback?.(invalid ? 'errors.waitlistEmail' : verification ? 'errors.verificationFailed' : 'errors.waitlistSubmit', verification ? 'verification' : 'error')
      turnstileRef.current?.reset()
    }
  }

  function handleExitAnimation(event: AnimationEvent<HTMLDivElement>) {
    if (event.animationName === 'waitlist-exit') onExitComplete()
  }

  return (
    <div className={'waitlist-email-stage' + (exiting ? ' is-exiting' : '')} onAnimationEnd={handleExitAnimation} inert={exiting} aria-hidden={exiting}>
      <p className="incentive entrance" style={{ animationDelay: '320ms' }}>
        <Trans i18nKey="waitlist.incentive" components={{ strong: <strong /> }} values={{ discount: "$50" }} />
      </p>
      <div className="waitlist-block">
        <form className={'waitlist-form entrance' + (verificationStatus === 'ready' || verificationStatus === 'expired' || verificationStatus === 'error' ? ' is-verifying' : '')} style={{ animationDelay: '400ms' }} onSubmit={handleSubmit} noValidate aria-busy={status === 'submitting'}>
          <div className={'waitlist-controls' + (status === 'invalid' || status === 'error' ? ' has-error' : '')}>
            <div className="email-field">
              <img src={mailIcon} width="24" height="24" alt="" aria-hidden="true" />
              <label htmlFor="waitlist-email" className="sr-only">{t('waitlist.emailLabel')}</label>
              <input
                id="waitlist-email"
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
                inputMode="email"
                placeholder={t('waitlist.emailPlaceholder')}
                value={email}
                readOnly={status === 'submitting' || exiting}
                aria-invalid={status === 'invalid'}
                aria-describedby={status === 'invalid' || status === 'error' ? 'waitlist-feedback waitlist-privacy' : 'waitlist-privacy'}
                onFocus={() => {
                  if (!startTracked.current) {
                    startTracked.current = true
                    trackEvent('waitlist_form_start')
                  }
                }}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (status === 'invalid' || status === 'error') {
                    setStatus('idle')
                    setMessage('')
                  }
                }}
              />
            </div>
            <p id="waitlist-privacy" className="privacy-note entrance" style={{ animationDelay: '480ms' }}>
              {t('waitlist.privacyNote')}{' '}<a href={localHref(privacyConfig.path)} target="_blank" rel="noopener noreferrer">{t('common.privacy')}<span className="sr-only"> {t('common.newTab')}</span></a>
            </p>
            <button className="submit-button" type="submit" disabled={status === 'submitting' || exiting || verificationPending}>
              {(status === 'submitting' || verificationPending) && <span className="loading-spinner" aria-hidden="true" />}
              <span>{status === 'submitting' ? t('waitlist.joining') : verificationPending ? t('common.verifying') : verificationStatus === 'error' || verificationStatus === 'expired' ? t('common.retryVerification') : t('waitlist.join')}</span>
            </button>
          </div>
          <TurnstileWidget ref={turnstileRef} action="waitlist" onStatusChange={handleVerificationChange} />
        </form>
        <span className="sr-only" aria-live="polite">
          {status === 'submitting' ? t('waitlist.joiningAnnouncement') : verificationPending ? t('common.verificationProgress') : ''}
        </span>
        {(status === 'invalid' || status === 'error') && (
          <p id="waitlist-feedback" className="form-feedback" role="alert">{t(message)}</p>
        )}
      </div>
    </div>
  )
}
