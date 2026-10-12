import { useEffect, useRef, useState, type AnimationEvent, type FormEvent } from 'react'
import savedIcon from '../assets/icons/zip-saved.svg'
import { updateWaitlistZip, WaitlistRequestError } from '../services/waitlistService'
import type { WaitlistRecord } from '../types/waitlist'

type ZipSaveStatus = 'idle' | 'saving' | 'exiting' | 'saved' | 'error'
const ZIP_REGEX = /^\d{5}(?:-?\d{4})?$/

interface ZipCodeFormProps {
  record: WaitlistRecord
  onSaved: (record: WaitlistRecord) => void
}

export function ZipCodeForm({ record, onSaved }: ZipCodeFormProps) {
  const [zipInput, setZipInput] = useState(record.zip_code ?? '')
  const [status, setStatus] = useState<ZipSaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [touched, setTouched] = useState(false)
  const savePending = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const savedMessageRef = useRef<HTMLParagraphElement>(null)
  const isValid = ZIP_REGEX.test(zipInput)
  const isUnchanged = record.zip_code === zipInput
  const showFormatError = touched && zipInput.length > 0 && !isValid

  useEffect(() => {
    if (status === 'saved') savedMessageRef.current?.focus({ preventScroll: true })
  }, [status])

  useEffect(() => {
    if (isEditing && status === 'idle') inputRef.current?.focus({ preventScroll: true })
  }, [isEditing, status])

  useEffect(() => {
    if (status !== 'exiting') return
    // Finish the handoff if animationend is unavailable or interrupted.
    const fallback = window.setTimeout(() => setStatus('saved'), 260)
    return () => window.clearTimeout(fallback)
  }, [status])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid || isUnchanged || savePending.current || status === 'exiting') return

    savePending.current = true
    setStatus('saving')

    try {
      const updatedRecord = await updateWaitlistZip({ record, zip_code: zipInput })
      onSaved(updatedRecord)
      setIsEditing(false)
      setStatus(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'saved' : 'exiting')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof WaitlistRequestError && error.kind === 'invalid_token'
        ? 'ZIP updates are unavailable for this registration.'
        : 'We couldn’t save your ZIP code. Please try again.')
    } finally {
      savePending.current = false
    }
  }

  function handleExitAnimation(event: AnimationEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && event.animationName === 'zip-collection-exit') {
      setStatus('saved')
    }
  }

  function handleEdit() {
    setZipInput(record.zip_code ?? '')
    setTouched(false)
    setIsEditing(true)
    setStatus('idle')
  }

  function handleCancel() {
    setZipInput(record.zip_code ?? '')
    setTouched(false)
    setIsEditing(false)
    setStatus('saved')
  }

  return (
    <section
      className="zip-section"
      aria-label={status === 'saved' ? 'ZIP code confirmation' : undefined}
      aria-labelledby={status === 'saved' ? undefined : 'zip-heading'}
    >
      {status === 'saved' ? (
        <div className="zip-saved-state">
          <img src={savedIcon} width="32" height="32" alt="" aria-hidden="true" />
          <p className="zip-saved-message" ref={savedMessageRef} tabIndex={-1}>Zip code saved. Thank you!</p>
          <button className="zip-edit-button" type="button" onClick={handleEdit}>Edit ZIP</button>
        </div>
      ) : (
        <div
          className={'zip-collection' + (status === 'exiting' ? ' is-exiting' : '') + (isEditing ? ' is-editing' : '')}
          onAnimationEnd={handleExitAnimation}
          inert={status === 'exiting'}
          aria-hidden={status === 'exiting'}
        >
          <div className="zip-intro">
            <div className="zip-intro-heading-row">
              <h3 id="zip-heading" className="zip-heading">Help us bring Mirembe to your neighborhood</h3>
              {isEditing && <button className="zip-cancel-button" type="button" onClick={handleCancel}>Cancel</button>}
            </div>
            <p id="zip-description" className="zip-description">Share your ZIP code so we know where to prioritize availability.</p>
          </div>
          <form className="zip-form" onSubmit={handleSave} noValidate aria-busy={status === 'saving'}>
            <div className={'zip-controls' + (showFormatError || status === 'error' ? ' has-error' : '')}>
              <label className="sr-only" htmlFor="waitlist-zip">ZIP code (optional)</label>
              <input
                ref={inputRef}
                id="waitlist-zip"
                name="zip_code"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={10}
                placeholder="Your ZIP code (optional)"
                value={zipInput}
                readOnly={status === 'saving' || status === 'exiting'}
                aria-invalid={showFormatError}
                aria-describedby={'zip-description' + (showFormatError || status === 'error' ? ' zip-feedback' : '')}
                onBlur={() => setTouched(true)}
                onChange={(event) => {
                  setZipInput(event.target.value)
                  if (status === 'error') setStatus('idle')
                }}
              />
              <button
                className="zip-save-button"
                type="submit"
                disabled={!isValid || isUnchanged || status === 'exiting'}
                aria-disabled={status === 'saving'}
              >
                {(status === 'saving' || status === 'exiting') && <span className="loading-spinner" aria-hidden="true" />}
                <span>{status === 'saving' || status === 'exiting' ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </form>
          {showFormatError && status !== 'error' && (
            <p id="zip-feedback" className="zip-feedback zip-error" role="alert">Enter a five-digit ZIP code or ZIP+4.</p>
          )}
          {status === 'error' && (
            <p id="zip-feedback" className="zip-feedback zip-error" role="alert">{errorMessage}</p>
          )}
        </div>
      )}
    </section>
  )
}
