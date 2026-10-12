import { useRef, useState, type FormEvent } from 'react'
import chevronIcon from '../../assets/icons/hiring-chevron.svg'
import radioOutline from '../../assets/icons/hiring-radio-outline.svg'
import { HiringRequestError, phoneDigits, submitHiringApplication, validateHiringApplication } from '../../services/hiringApplicationService'
import {
  availabilityOptions,
  experienceOptions,
  initialHiringApplication,
  languageOptions,
  travelOptions,
  type HiringApplicationInput,
  type HiringApplicationRecord,
  type HiringErrors,
  type HiringField,
  type SpokenLanguage,
} from '../../types/hiring'

type SubmissionStatus = 'idle' | 'submitting' | 'error'

interface TextFieldProps {
  name: HiringField
  label: string
  value: string
  placeholder: string
  autoComplete?: string
  type?: 'text' | 'email' | 'tel'
  inputMode?: 'numeric'
  error?: string
  onChange: (value: string) => void
  onBlur: () => void
}

function TextField({ name, label, value, placeholder, autoComplete, type = 'text', inputMode, error, onChange, onBlur }: TextFieldProps) {
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
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `hiring-${name}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error && <p className="hiring-field-error" id={`hiring-${name}-error`}>{error}</p>}
    </div>
  )
}

interface ChoiceGroupProps<T extends string> {
  name: HiringField
  legend: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T | null
  error?: string
  onSelect: (value: T) => void
}

function ChoiceGroup<T extends string>({ name, legend, options, value, error, onSelect }: ChoiceGroupProps<T>) {
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
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="hiring-field-error" id={`hiring-${name}-error`}>{error}</p>}
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
  onAccepted: (record: HiringApplicationRecord) => void
}

export function HiringApplicationForm({ onAccepted }: HiringApplicationFormProps) {
  const [form, setForm] = useState<HiringApplicationInput>(() => ({ ...initialHiringApplication, languages: [] }))
  const [errors, setErrors] = useState<HiringErrors>({})
  const [status, setStatus] = useState<SubmissionStatus>('idle')
  const [submitError, setSubmitError] = useState('')
  const pending = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  function updateField<K extends HiringField>(field: K, value: HiringApplicationInput[K]) {
    const nextForm = { ...form, [field]: value }
    setForm(nextForm)
    setErrors((current) => ({ ...current, [field]: current[field] ? validateHiringApplication(nextForm)[field] : undefined }))
    if (status === 'error') {
      setStatus('idle')
      setSubmitError('')
    }
  }

  function validateField(field: HiringField) {
    const message = validateHiringApplication(form)[field]
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
    if (pending.current) return

    const nextErrors = validateHiringApplication(form)
    setErrors(nextErrors)
    const firstInvalid = validationOrder.find((field) => nextErrors[field])
    if (firstInvalid) {
      const target = formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      return
    }

    pending.current = true
    setStatus('submitting')
    try {
      const record = await submitHiringApplication(form)
      onAccepted(record)
    } catch (error) {
      setStatus('error')
      setSubmitError(error instanceof HiringRequestError && error.kind === 'invalid'
        ? 'Please review your answers and try again.'
        : 'We couldn’t submit your application. Please try again.')
    } finally {
      pending.current = false
    }
  }

  return (
    <form ref={formRef} className="hiring-form-layout" onSubmit={handleSubmit} aria-busy={status === 'submitting'} noValidate>
      <div className="hiring-form-scroll" tabIndex={0} aria-label="Application questions">
        <section className="hiring-section" aria-labelledby="hiring-personal-heading">
          <h3 id="hiring-personal-heading">Tell us about yourself</h3>
          <div className="hiring-personal-fields">
            <div className="hiring-field-row">
              <TextField name="first_name" label="First name" value={form.first_name} placeholder="First name" autoComplete="given-name" error={errors.first_name} onChange={(value) => updateField('first_name', value)} onBlur={() => validateField('first_name')} />
              <TextField name="last_name" label="Last name" value={form.last_name} placeholder="Last name" autoComplete="family-name" error={errors.last_name} onChange={(value) => updateField('last_name', value)} onBlur={() => validateField('last_name')} />
            </div>
            <div className="hiring-field-row is-email-row">
              <TextField name="email" label="Email" type="email" value={form.email} placeholder="you@example.com" autoComplete="email" error={errors.email} onChange={(value) => updateField('email', value)} onBlur={() => validateField('email')} />
              <TextField name="phone" label="Phone number" type="tel" inputMode="numeric" value={form.phone} placeholder="(000) 000-0000" autoComplete="tel" error={errors.phone} onChange={(value) => updateField('phone', phoneDigits(value))} onBlur={() => validateField('phone')} />
            </div>
            <div className="hiring-field-row">
              <TextField name="city" label="City / Town" value={form.city} placeholder="Your town" autoComplete="address-level2" error={errors.city} onChange={(value) => updateField('city', value)} onBlur={() => validateField('city')} />
              <div className="hiring-field">
                <label htmlFor="hiring-state">State <span aria-hidden="true">*</span></label>
                <div className="hiring-select-wrap">
                  <select id="hiring-state" name="state" value={form.state ?? ''} required aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? 'hiring-state-error' : undefined} onChange={(event) => updateField('state', event.target.value === 'CT' || event.target.value === 'MA' ? event.target.value : null)} onBlur={() => validateField('state')}>
                    <option value="">Select your state</option>
                    <option value="CT">Connecticut</option>
                    <option value="MA">Massachusetts</option>
                  </select>
                  <img src={chevronIcon} width="24" height="24" alt="" aria-hidden="true" />
                </div>
                {errors.state && <p className="hiring-field-error" id="hiring-state-error">{errors.state}</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="hiring-section hiring-experience" aria-labelledby="hiring-experience-heading">
          <h3 id="hiring-experience-heading">A little about your experience</h3>
          <ChoiceGroup name="has_vehicle" legend="Do you have access to a personal vehicle?" options={vehicleOptions} value={form.has_vehicle === null ? null : form.has_vehicle ? 'yes' : 'no'} error={errors.has_vehicle} onSelect={(value) => updateField('has_vehicle', value === 'yes')} />
          <ChoiceGroup name="cleaning_experience" legend="Professional cleaning experience" options={experienceOptions} value={form.cleaning_experience} error={errors.cleaning_experience} onSelect={(value) => updateField('cleaning_experience', value)} />

          <fieldset className={'hiring-question hiring-languages' + (errors.languages ? ' has-error' : '')} aria-describedby={errors.languages ? 'hiring-languages-error' : undefined}>
            <legend>Languages spoken (select all that apply) <span aria-hidden="true">*</span></legend>
            <div className="hiring-language-options">
              {languageOptions.map((option) => (
                <label className="hiring-choice" key={option.value}>
                  <input type="checkbox" name="languages" value={option.value} checked={form.languages.includes(option.value)} onChange={() => toggleLanguage(option.value)} />
                  <span className="hiring-choice-mark" aria-hidden="true"><img src={radioOutline} width="24" height="24" alt="" /><svg className="hiring-checkbox-check" viewBox="0 0 16 16" fill="none" focusable="false"><path d="M3 8.2 6.5 11.5 13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {errors.languages && <p className="hiring-field-error" id="hiring-languages-error">{errors.languages}</p>}
            {form.languages.includes('other') && (
              <div className="hiring-other-language">
                <TextField name="other_language" label="Other language" value={form.other_language ?? ''} placeholder="Specify language" error={errors.other_language} onChange={(value) => updateField('other_language', value)} onBlur={() => validateField('other_language')} />
              </div>
            )}
          </fieldset>

          <ChoiceGroup name="travel_distance" legend="How far are you willing to travel for work?" options={travelOptions} value={form.travel_distance} error={errors.travel_distance} onSelect={(value) => updateField('travel_distance', value)} />
          <ChoiceGroup name="preferred_availability" legend="Preferred availability" options={availabilityOptions} value={form.preferred_availability} error={errors.preferred_availability} onSelect={(value) => updateField('preferred_availability', value)} />
        </section>
      </div>
      <footer className="hiring-footer">
        {status === 'error' && <p className="hiring-submit-error" role="alert">{submitError}</p>}
        <button className="hiring-submit" type="submit" aria-disabled={status === 'submitting'}>
          {status === 'submitting' && <span className="loading-spinner" aria-hidden="true" />}
          <span aria-live="polite">{status === 'submitting' ? 'Submitting…' : 'Submit Application'}</span>
        </button>
      </footer>
    </form>
  )
}
