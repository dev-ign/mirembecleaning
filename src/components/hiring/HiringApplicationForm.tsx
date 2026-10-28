import { useLocalizedHref } from '../../i18n/useLocalizedHref'
import { hiringOptionKeys } from '../../i18n/hiring'
import { t, useLocale, type MessageKey } from '../../i18n'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import chevronIcon from '../../assets/icons/hiring-chevron.svg'
import radioOutline from '../../assets/icons/hiring-radio-outline.svg'
import { TurnstileWidget, type TurnstileStatus, type TurnstileWidgetHandle } from '../TurnstileWidget'
import { HiringRequestError, phoneDigits, submitHiringApplication, validateHiringApplication } from '../../services/hiringApplicationService'
import {
  availabilityOptions,
  experienceOptions,
  initialHiringApplication,
  languageOptions,
  travelOptions,
  type HiringApplicationInput,
  type HiringApplicationRecord,
  type HiringField,
  type SpokenLanguage,
} from '../../types/hiring'
import { trackEvent } from '../../lib/optionalEvents'
import { privacyConfig } from '../../config/legal'

const validateForm = (input: HiringApplicationInput) => validateHiringApplication(input, key => key) as Partial<Record<HiringField, MessageKey>>

type SubmissionStatus = 'idle' | 'submitting' | 'error'

interface TextFieldProps {
  name: HiringField
  label: string
  value: string
  placeholder: string
  autoComplete?: string
  type?: 'text' | 'email' | 'tel'
  inputMode?: 'numeric'
  error?: MessageKey
  onChange: (value: string) => void
  onBlur: () => void
}

function TextField({ name, label, value, placeholder, autoComplete, type = 'text', inputMode, error, onChange, onBlur }: TextFieldProps) {
  useLocale()
  return (
    <div className="hiring-field">
      <label htmlFor={`hiring-${name}`}>{label} <span aria-hidden="true">*</span></label>
      <input
        id={`hiring-${name}`}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        maxLength={name === 'email' ? 254 : name === 'phone' ? 32 : name === 'city' ? 100 : 80}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `hiring-${name}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error && <p className="hiring-field-error" id={`hiring-${name}-error`}>{t(error)}</p>}
    </div>
  )
}

interface ChoiceGroupProps<T extends string> {
  name: HiringField
  legend: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T | null
  error?: MessageKey
  onSelect: (value: T) => void
}

function ChoiceGroup<T extends string>({ name, legend, options, value, error, onSelect }: ChoiceGroupProps<T>) {
  useLocale()
  return (
    <fieldset className={'hiring-question' + (error ? ' has-error' : '')} aria-describedby={error ? `hiring-${name}-error` : undefined}>
      <legend>{legend} <span aria-hidden="true">*</span></legend>
      <div className="hiring-options">
        {options.map((option) => (
          <label className="hiring-choice" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onSelect(option.value)}
            />
            <span className="hiring-choice-mark" aria-hidden="true"><img src={radioOutline} width="24" height="24" alt="" /><span className="hiring-radio-dot" /></span>
            <span>{t(hiringOptionKeys[option.value as keyof typeof hiringOptionKeys])}</span>
          </label>
        ))}
      </div>
      {error && <p className="hiring-field-error" id={`hiring-${name}-error`}>{t(error)}</p>}
    </fieldset>
  )
}

const vehicleOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

const validationOrder: HiringField[] = [
  'first_name', 'last_name', 'email', 'phone', 'city', 'state',
  'has_vehicle', 'cleaning_experience', 'languages', 'other_language',
  'travel_distance', 'preferred_availability',
]

interface HiringApplicationFormProps {
  active: boolean
  onAccepted: (record: HiringApplicationRecord) => void
}

export function HiringApplicationForm({ active, onAccepted }: HiringApplicationFormProps) {
  const localHref = useLocalizedHref()
  useLocale()
  const [form, setForm] = useState<HiringApplicationInput>(() => ({ ...initialHiringApplication, languages: [] }))
  const [errors, setErrors] = useState<Partial<Record<HiringField, MessageKey>>>({})
  const [status, setStatus] = useState<SubmissionStatus>('idle')
  const [submitError, setSubmitError] = useState<MessageKey>('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<TurnstileStatus>('loading')
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)
  const pending = useRef(false)
  const startTracked = useRef(false)
  const submissionKey = useRef<string | null>(null)
  const verificationErrorActive = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const handleVerificationChange = useCallback((nextStatus: TurnstileStatus, token = '') => {
    setVerificationStatus(nextStatus)
    setTurnstileToken(token)
    if (nextStatus === 'error') {
      verificationErrorActive.current = true
      setStatus((current) => current === 'submitting' ? current : 'error')
      setSubmitError('errors.verificationLoad')
    } else if (nextStatus === 'verified' && verificationErrorActive.current) {
      verificationErrorActive.current = false
      setStatus((current) => current === 'error' ? 'idle' : current)
      setSubmitError('')
    }
  }, [])
  const verificationPending = verificationStatus === 'loading' || verificationStatus === 'ready'

  function updateField<K extends HiringField>(field: K, value: HiringApplicationInput[K]) {
    if (!startTracked.current) {
      startTracked.current = true
      trackEvent('hiring_form_start')
    }
    submissionKey.current = null
    const nextForm = { ...form, [field]: value }
    setForm(nextForm)
    setErrors((current) => ({ ...current, [field]: current[field] ? validateForm(nextForm)[field] : undefined }))
    if (status === 'error') {
      setStatus('idle')
      setSubmitError('')
    }
  }

  function validateField(field: HiringField) {
    const message = validateForm(form)[field]
    setErrors((current) => ({ ...current, [field]: message }))
  }

  function toggleLanguage(language: SpokenLanguage) {
    updateField('languages', form.languages.includes(language)
      ? form.languages.filter((item) => item !== language)
      : [...form.languages, language])
    setErrors((current) => ({ ...current, other_language: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !active) return
    if (verificationStatus === 'error' || verificationStatus === 'expired') {
      verificationErrorActive.current = false
      setStatus('idle')
      setSubmitError('')
      turnstileRef.current?.reset()
      return
    }

    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    const firstInvalid = validationOrder.find((field) => nextErrors[field])
    if (firstInvalid) {
      const target = formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      return
    }
    if (verificationStatus !== 'verified' || !turnstileToken) return

    pending.current = true
    trackEvent('hiring_form_submit')
    setStatus('submitting')
    try {
      submissionKey.current ??= crypto.randomUUID()
      const record = await submitHiringApplication(form, turnstileToken, submissionKey.current)
      if (!record.replayed) trackEvent('hiring_application_success', record.id)
      onAccepted(record)
    } catch (error) {
      trackEvent('hiring_application_error')
      pending.current = false
      verificationErrorActive.current = error instanceof HiringRequestError && error.kind === 'verification'
      setStatus('error')
      setSubmitError(error instanceof HiringRequestError && error.kind === 'invalid'
        ? 'errors.hiringReview'
        : error instanceof HiringRequestError && error.kind === 'verification'
          ? 'errors.verificationFailed'
          : 'errors.hiringSubmit')
      turnstileRef.current?.reset()
    }
  }

  return (
    <form ref={formRef} className="hiring-form-layout" onSubmit={handleSubmit} aria-busy={status === 'submitting'} noValidate>
      <div className="hiring-form-scroll" tabIndex={0} aria-label={t('hiring.questions')}>
        <section className="hiring-section" aria-labelledby="hiring-personal-heading">
          <h3 id="hiring-personal-heading">{t('hiring.personal')}</h3>
          <div className="hiring-personal-fields">
            <div className="hiring-field-row">
              <TextField name="first_name" label={t('hiring.firstName')} value={form.first_name} placeholder={t('hiring.firstName')} autoComplete="given-name" error={errors.first_name} onChange={(value) => updateField('first_name', value)} onBlur={() => validateField('first_name')} />
              <TextField name="last_name" label={t('hiring.lastName')} value={form.last_name} placeholder={t('hiring.lastName')} autoComplete="family-name" error={errors.last_name} onChange={(value) => updateField('last_name', value)} onBlur={() => validateField('last_name')} />
            </div>
            <div className="hiring-field-row is-email-row">
              <TextField name="email" label={t('hiring.email')} type="email" value={form.email} placeholder={t('hiring.emailPlaceholder')} autoComplete="email" error={errors.email} onChange={(value) => updateField('email', value)} onBlur={() => validateField('email')} />
              <TextField name="phone" label={t('hiring.phone')} type="tel" inputMode="numeric" value={form.phone} placeholder="(000) 000-0000" autoComplete="tel" error={errors.phone} onChange={(value) => updateField('phone', phoneDigits(value))} onBlur={() => validateField('phone')} />
            </div>
            <div className="hiring-field-row">
              <TextField name="city" label={t('hiring.city')} value={form.city} placeholder={t('hiring.cityPlaceholder')} autoComplete="address-level2" error={errors.city} onChange={(value) => updateField('city', value)} onBlur={() => validateField('city')} />
              <div className="hiring-field">
                <label htmlFor="hiring-state">{t('hiring.state')}<span aria-hidden="true">*</span></label>
                <div className="hiring-select-wrap">
                  <select id="hiring-state" name="state" value={form.state ?? ''} required aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? 'hiring-state-error' : undefined} onChange={(event) => updateField('state', event.target.value === 'CT' || event.target.value === 'MA' ? event.target.value : null)} onBlur={() => validateField('state')}>
                    <option value="">{t('hiring.selectState')}</option>
                    <option value="CT">Connecticut</option>
                    <option value="MA">Massachusetts</option>
                  </select>
                  <img src={chevronIcon} width="24" height="24" alt="" aria-hidden="true" />
                </div>
                {errors.state && <p className="hiring-field-error" id="hiring-state-error">{t(errors.state)}</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="hiring-section hiring-experience" aria-labelledby="hiring-experience-heading">
          <h3 id="hiring-experience-heading">{t('hiring.experienceTitle')}</h3>
          <ChoiceGroup name="has_vehicle" legend={t('hiring.vehicle')} options={vehicleOptions} value={form.has_vehicle === null ? null : form.has_vehicle ? 'yes' : 'no'} error={errors.has_vehicle} onSelect={(value) => updateField('has_vehicle', value === 'yes')} />
          <ChoiceGroup name="cleaning_experience" legend={t('hiring.experience')} options={experienceOptions} value={form.cleaning_experience} error={errors.cleaning_experience} onSelect={(value) => updateField('cleaning_experience', value)} />

          <fieldset className={'hiring-question hiring-languages' + (errors.languages ? ' has-error' : '')} aria-describedby={errors.languages ? 'hiring-languages-error' : undefined}>
            <legend>{t('hiring.languages')}<span aria-hidden="true">*</span></legend>
            <div className="hiring-language-options">
              {languageOptions.map((option) => (
                <label className="hiring-choice" key={option.value}>
                  <input type="checkbox" name="languages" value={option.value} checked={form.languages.includes(option.value)} onChange={() => toggleLanguage(option.value)} />
                  <span className="hiring-choice-mark" aria-hidden="true"><img src={radioOutline} width="24" height="24" alt="" /><svg className="hiring-checkbox-check" viewBox="0 0 16 16" fill="none" focusable="false"><path d="M3 8.2 6.5 11.5 13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <span>{t(hiringOptionKeys[option.value as keyof typeof hiringOptionKeys])}</span>
                </label>
              ))}
            </div>
            {errors.languages && <p className="hiring-field-error" id="hiring-languages-error">{t(errors.languages)}</p>}
            {form.languages.includes('other') && (
              <div className="hiring-other-language">
                <TextField name="other_language" label={t('hiring.otherLanguage')} value={form.other_language ?? ''} placeholder={t('hiring.specifyLanguage')} error={errors.other_language} onChange={(value) => updateField('other_language', value)} onBlur={() => validateField('other_language')} />
              </div>
            )}
          </fieldset>

          <ChoiceGroup name="travel_distance" legend={t('hiring.travel')} options={travelOptions} value={form.travel_distance} error={errors.travel_distance} onSelect={(value) => updateField('travel_distance', value)} />
          <ChoiceGroup name="preferred_availability" legend={t('hiring.availability')} options={availabilityOptions} value={form.preferred_availability} error={errors.preferred_availability} onSelect={(value) => updateField('preferred_availability', value)} />
        </section>
      </div>
      <footer className="hiring-footer">
        <p className="hiring-privacy">{t('hiring.privacy')}{' '}<a href={localHref(privacyConfig.path)} target="_blank" rel="noopener noreferrer">{t('common.privacy')}<span className="sr-only"> {t('common.newTab')}</span></a></p>
        {active && <TurnstileWidget ref={turnstileRef} action="applicants" onStatusChange={handleVerificationChange} />}
        {status === 'error' && <p className="hiring-submit-error" role="alert">{t(submitError)}</p>}
        <button className="hiring-submit" type="submit" disabled={status === 'submitting' || verificationPending} aria-disabled={status === 'submitting' || verificationPending}>
          {(status === 'submitting' || verificationPending) && <span className="loading-spinner" aria-hidden="true" />}
          <span aria-live="polite">{status === 'submitting' ? t('hiring.submitting') : verificationPending ? t('hiring.verifying') : verificationStatus === 'error' || verificationStatus === 'expired' ? t('common.retryVerification') : t('hiring.submit')}</span>
        </button>
      </footer>
    </form>
  )
}
