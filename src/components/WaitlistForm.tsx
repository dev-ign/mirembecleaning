import { useRef, useState, type AnimationEvent, type FormEvent } from 'react'
import mailIcon from '../assets/icons/mail.svg'
import { createWaitlistEntry, WaitlistRequestError } from '../services/waitlistService'
import type { WaitlistRecord } from '../types/waitlist'

type FormStatus = 'idle' | 'invalid' | 'submitting' | 'error'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const privacyPolicyUrl = import.meta.env.VITE_PRIVACY_POLICY_URL?.trim()

interface WaitlistFormProps {
  onCreated: (record: WaitlistRecord) => void
  exiting: boolean
  onExitComplete: () => void
}

export function WaitlistForm({ onCreated, exiting, onExitComplete }: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [message, setMessage] = useState('')
  const submitPending = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitPending.current || exiting) return

    const normalizedEmail = email.trim().toLowerCase()
    setEmail(normalizedEmail)

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setStatus('invalid')
      setMessage('Enter a valid email address to join the waitlist.')
      return
    }

    submitPending.current = true
    setStatus('submitting')
    setMessage('')

    try {
      const record = await createWaitlistEntry({ email: normalizedEmail, source: 'landing_page' })
      onCreated(record)
    } catch (error) {
      submitPending.current = false
      const invalid = error instanceof WaitlistRequestError && error.kind === 'invalid'
      setStatus(invalid ? 'invalid' : 'error')
      setMessage(invalid
        ? 'Enter a valid email address to join the waitlist.'
        : 'We couldn’t add you right now. Please try again.')
    }
  }

  function handleExitAnimation(event: AnimationEvent<HTMLDivElement>) {
    if (event.animationName === 'waitlist-exit') onExitComplete()
  }

  return (
    <div className={'waitlist-email-stage' + (exiting ? ' is-exiting' : '')} onAnimationEnd={handleExitAnimation} inert={exiting} aria-hidden={exiting}>
      <p className="incentive entrance" style={{ animationDelay: '320ms' }}>
        <strong>Priority booking</strong> + <strong>$50 off</strong> the first recurring clean
      </p>
      <div className="waitlist-block">
        <form className="waitlist-form entrance" style={{ animationDelay: '400ms' }} onSubmit={handleSubmit} noValidate aria-busy={status === 'submitting'}>
          <div className={'waitlist-controls' + (status === 'invalid' || status === 'error' ? ' has-error' : '')}>
            <div className="email-field">
              <img src={mailIcon} width="24" height="24" alt="" aria-hidden="true" />
              <label htmlFor="waitlist-email" className="sr-only">Email address</label>
              <input
                id="waitlist-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="Enter your email address"
                value={email}
                readOnly={status === 'submitting' || exiting}
                aria-invalid={status === 'invalid'}
                aria-describedby={status === 'invalid' || status === 'error' ? 'waitlist-feedback waitlist-privacy' : 'waitlist-privacy'}
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
              Get launch updates and early access to booking. No spam.
              {privacyPolicyUrl && <> <a href={privacyPolicyUrl}>Privacy Policy</a></>}
            </p>
            <button className="submit-button" type="submit" disabled={status === 'submitting' || exiting}>
              {status === 'submitting' && <span className="loading-spinner" aria-hidden="true" />}
              <span>{status === 'submitting' ? 'Joining...' : 'Join the Waitlist'}</span>
            </button>
          </div>
        </form>
        <span className="sr-only" aria-live="polite">
          {status === 'submitting' ? 'Joining the waitlist…' : ''}
        </span>
        {(status === 'invalid' || status === 'error') && (
          <p id="waitlist-feedback" className="form-feedback" role="alert">{message}</p>
        )}
      </div>
    </div>
  )
}
