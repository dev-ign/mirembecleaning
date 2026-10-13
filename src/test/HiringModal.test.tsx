import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { submitHiringApplication } from '../services/hiringApplicationService'
import { createWaitlistEntry } from '../services/waitlistService'
import type { HiringApplicationInput, HiringApplicationRecord } from '../types/hiring'

let autoVerifyHiring = true
let emitHiringVerification: ((status: string, token?: string) => void) | undefined

vi.mock('../components/TurnstileWidget', async () => {
  const { forwardRef, useEffect, useImperativeHandle } = await import('react')
  return {
    TurnstileWidget: forwardRef<{ reset: () => void }, { action: string; onStatusChange: (status: string, token?: string) => void }>(function MockTurnstile({ action, onStatusChange }, ref) {
      if (action === 'applicants') emitHiringVerification = onStatusChange
      useImperativeHandle(ref, () => ({ reset: () => { onStatusChange('loading'); onStatusChange('verified', 'retry-token') } }), [onStatusChange])
      useEffect(() => { onStatusChange('ready'); if (action !== 'applicants' || autoVerifyHiring) onStatusChange('verified', 'test-token'); return () => onStatusChange('loading') }, [action, onStatusChange])
      return action === 'applicants' ? <div data-testid="hiring-turnstile" /> : null
    }),
  }
})

vi.mock('../services/hiringApplicationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/hiringApplicationService')>()
  return { ...actual, submitHiringApplication: vi.fn() }
})

vi.mock('../services/waitlistService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/waitlistService')>()
  return { ...actual, createWaitlistEntry: vi.fn() }
})

const record: HiringApplicationRecord = {
  id: 'application-1',
  source: 'landing_page',
  created_at: '2026-10-10T15:00:00.000Z',
  first_name: 'Ari',
  last_name: 'Rivera',
  email: 'ari@example.com',
  phone: '8605550134',
  city: 'Hartford',
  state: 'CT',
  has_vehicle: false,
  cleaning_experience: 'under_1_year',
  languages: ['english', 'spanish'],
  other_language: null,
  travel_distance: '20_miles',
  preferred_availability: 'part_time',
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) { this.open = true },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) { this.open = false },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Interested in joining our cleaning team?' }))
  return screen.getByRole('dialog')
}

function fillValidForm(dialog: HTMLElement) {
  fireEvent.change(screen.getByRole('textbox', { name: 'First name' }), { target: { value: 'Ari' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Last name' }), { target: { value: 'Rivera' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'ari@example.com' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Phone number' }), { target: { value: '8605550134' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'City / Town' }), { target: { value: 'Hartford' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'State' }), { target: { value: 'CT' } })
  fireEvent.click(screen.getByRole('radio', { name: /^No$/ }))
  fireEvent.click(screen.getByRole('radio', { name: 'Under 1 year' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'English' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Spanish' }))
  fireEvent.click(screen.getByRole('radio', { name: '20 miles' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Part-time' }))
  expect(dialog).toBeInTheDocument()
}

describe('hiring modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autoVerifyHiring = true
    emitHiringVerification = undefined
    vi.mocked(submitHiringApplication).mockResolvedValue(record)
    vi.mocked(createWaitlistEntry).mockResolvedValue({
      id: 'waitlist-1',
      email: 'customer@example.com',
      zip_code: null,
      zip_token: 'test-zip-token',
      source: 'landing_page',
      created_at: '2026-10-10T15:00:00.000Z',
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })
  })

  it('waits for verification and allows a failed challenge to be retried', async () => {
    autoVerifyHiring = false
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openModal(user)
    fillValidForm(dialog)
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(submitHiringApplication).not.toHaveBeenCalled()

    act(() => emitHiringVerification?.('error'))
    expect(screen.getByRole('alert')).toHaveTextContent('Verification could not load')
    await user.click(screen.getByRole('button', { name: 'Retry verification' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    expect(submitHiringApplication).toHaveBeenCalledExactlyOnceWith(expect.any(Object), 'retry-token', expect.any(String))
  })

  it('opens with focus, locks background scroll, and preserves a draft after close', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByTestId('hiring-turnstile')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Interested in joining our cleaning team?' })
    const dialog = await openModal(user)
    expect(screen.getByTestId('hiring-turnstile')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Join the Mirembe team.' })).toHaveFocus()
    expect(dialog).toHaveAttribute('open')
    expect(document.body.style.overflow).toBe('hidden')
    await user.type(screen.getByRole('textbox', { name: 'First name' }), 'Ari')
    await user.click(screen.getByRole('button', { name: 'Close application form' }))
    expect(dialog).not.toHaveAttribute('open')
    expect(screen.queryByTestId('hiring-turnstile')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(trigger).toHaveFocus()

    await openModal(user)
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('Ari')
  })

  it('dismisses on Escape and backdrop, while inside clicks keep the dialog open', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openModal(user)
    fireEvent.click(dialog.querySelector('.hiring-surface')!)
    expect(dialog).toHaveAttribute('open')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(dialog).not.toHaveAttribute('open')

    await openModal(user)
    fireEvent.click(dialog, { clientX: -1, clientY: -1 })
    expect(dialog).not.toHaveAttribute('open')
    expect(screen.getByRole('button', { name: 'Interested in joining our cleaning team?' })).toHaveFocus()
  })

  it('wraps keyboard focus at the dialog boundaries', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModal(user)
    const close = screen.getByRole('button', { name: 'Close application form' })
    const submit = screen.getByRole('button', { name: 'Submit Application' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(submit).toHaveFocus()
    fireEvent.keyDown(submit, { key: 'Tab' })
    expect(close).toHaveFocus()
  })

  it('validates required fields and contact input without losing entered values', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModal(user)
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveFocus()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(submitHiringApplication).not.toHaveBeenCalled()

    const email = screen.getByRole('textbox', { name: 'Email' })
    fireEvent.change(email, { target: { value: 'invalid' } })
    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'true')
    const phone = screen.getByRole('textbox', { name: 'Phone number' })
    fireEvent.change(phone, { target: { value: '123' } })
    fireEvent.blur(phone)
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveValue('invalid')
    expect(phone).toHaveValue('123')
  })

  it('keeps email editable, validates it on blur, and clears its error when corrected', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModal(user)
    const email = screen.getByRole('textbox', { name: 'Email' })
    await user.type(email, 'name+tag@')
    expect(email).toHaveValue('name+tag@')
    expect(email).toHaveAttribute('aria-invalid', 'false')
    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAttribute('aria-describedby', 'hiring-email-error')
    fireEvent.change(email, { target: { value: ' name+tag@example.technology ' } })
    fireEvent.blur(email)
    expect(email).toHaveAttribute('aria-invalid', 'false')
    expect(email).toHaveValue('name+tag@example.technology')
  })

  it('stores only phone digits and accepts formatted US pastes without truncating international numbers', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModal(user)
    const phone = screen.getByRole('textbox', { name: 'Phone number' })
    expect(phone).toHaveAttribute('type', 'tel')
    expect(phone).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(phone, { target: { value: '+1 (617) 555-0123' } })
    expect(phone).toHaveValue('6175550123')
    fireEvent.change(phone, { target: { value: '617555012' } })
    fireEvent.blur(phone)
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(phone, { target: { value: '+44 20 7946 0958' } })
    expect(phone).toHaveValue('442079460958')
    fireEvent.blur(phone)
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(phone, { target: { value: '617abc5550123' } })
    fireEvent.blur(phone)
    expect(phone).toHaveValue('6175550123')
    expect(phone).toHaveAttribute('aria-invalid', 'false')
  })

  it('uses exclusive radios and independent language checkboxes with Other detail', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModal(user)
    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('radio', { name: /^No$/ }))
    expect(screen.getByRole('radio', { name: 'Yes' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /^No$/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Under 1 year' }))
    await user.click(screen.getByRole('radio', { name: '3+ years' }))
    expect(screen.getByRole('radio', { name: 'Under 1 year' })).not.toBeChecked()
    await user.click(screen.getByRole('radio', { name: '10 miles' }))
    await user.click(screen.getByRole('radio', { name: '20 miles' }))
    expect(screen.getByRole('radio', { name: '10 miles' })).not.toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Full-time' }))
    await user.click(screen.getByRole('radio', { name: 'Part-time' }))
    expect(screen.getByRole('radio', { name: 'Full-time' })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'English' }))
    await user.click(screen.getByRole('checkbox', { name: 'Spanish' }))
    await user.click(screen.getByRole('checkbox', { name: 'Other' }))
    expect(screen.getByRole('checkbox', { name: 'English' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Spanish' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'English' }).nextElementSibling?.querySelector('.hiring-checkbox-check')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3+ years' }).nextElementSibling?.querySelector('.hiring-radio-dot')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Other language' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    expect(screen.getByText('Specify the other language.')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Other' }))
    expect(screen.queryByRole('textbox', { name: 'Other language' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'English' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Spanish' }))
    expect(screen.getByRole('checkbox', { name: 'Spanish' })).not.toBeChecked()
  })

  it('submits once, shows confirmation, and keeps it on reopen', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openModal(user)
    fillValidForm(dialog)
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    const heading = await screen.findByRole('heading', { name: "We've received your application." })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(dialog).toHaveClass('is-success')
    expect(screen.getByText('Thank you for your interest in joining the Mirembe team. We will review your application and someone from our team will be in touch soon!')).toBeInTheDocument()
    expect(dialog.querySelector('.hiring-success-icon')).toHaveAttribute('width', '127')
    expect(dialog.querySelector('.hiring-form-layout')).not.toBeInTheDocument()
    expect(submitHiringApplication).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      first_name: 'Ari', email: 'ari@example.com', state: 'CT', has_vehicle: false,
      cleaning_experience: 'under_1_year', languages: ['english', 'spanish'],
      travel_distance: '20_miles', preferred_availability: 'part_time',
    } satisfies Partial<HiringApplicationInput>), 'test-token', expect.any(String))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await openModal(user)
    expect(screen.getByRole('heading', { name: "We've received your application." })).toHaveFocus()
    expect(submitHiringApplication).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Close application confirmation' }))
    expect(screen.getByRole('button', { name: 'Interested in joining our cleaning team?' })).toHaveFocus()
  })

  it('blocks duplicate requests and keeps form values after a failure for retry', async () => {
    const user = userEvent.setup()
    let fail!: (error: Error) => void
    vi.mocked(submitHiringApplication).mockReturnValueOnce(new Promise((_, reject) => { fail = reject }))
    render(<App />)
    const dialog = await openModal(user)
    fillValidForm(dialog)
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    const submitting = screen.getByRole('button', { name: 'Submitting…' })
    expect(submitting).toHaveFocus()
    expect(submitting).toHaveAttribute('aria-disabled', 'true')
    await user.click(submitting)
    expect(submitHiringApplication).toHaveBeenCalledTimes(1)
    fail(new Error('offline'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again')
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('Ari')
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    expect(await screen.findByRole('heading', { name: "We've received your application." })).toBeInTheDocument()
    expect(submitHiringApplication).toHaveBeenCalledTimes(2)
    expect(submitHiringApplication).toHaveBeenNthCalledWith(1, expect.any(Object), 'test-token', expect.any(String))
    expect(submitHiringApplication).toHaveBeenNthCalledWith(2, expect.any(Object), 'retry-token', expect.any(String))
    expect(vi.mocked(submitHiringApplication).mock.calls[0][2]).toBe(vi.mocked(submitHiringApplication).mock.calls[1][2])
  })

  it('keeps the form in place until acceptance, then exits before the compact confirmation', async () => {
    const user = userEvent.setup()
    let accept!: (record: HiringApplicationRecord) => void
    vi.mocked(submitHiringApplication).mockReturnValueOnce(new Promise((resolve) => { accept = resolve }))
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) })
    render(<App />)
    const dialog = await openModal(user)
    fillValidForm(dialog)
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    expect(dialog).not.toHaveClass('is-success')
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: "We've received your application." })).not.toBeInTheDocument()
    accept(record)
    await waitFor(() => expect(dialog.querySelector('.hiring-surface')).toHaveClass('is-exiting'))
    expect(dialog).not.toHaveClass('is-success')
    fireEvent.animationEnd(dialog.querySelector('.hiring-surface')!)
    expect(await screen.findByRole('heading', { name: "We've received your application." })).toHaveFocus()
    expect(dialog).toHaveClass('is-success')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('preserves trigger focus if acceptance arrives after the dialog was dismissed', async () => {
    const user = userEvent.setup()
    let accept!: (record: HiringApplicationRecord) => void
    vi.mocked(submitHiringApplication).mockReturnValueOnce(new Promise((resolve) => { accept = resolve }))
    render(<App />)
    const dialog = await openModal(user)
    fillValidForm(dialog)
    await user.click(screen.getByRole('button', { name: 'Submit Application' }))
    await user.click(screen.getByRole('button', { name: 'Close application form' }))
    const trigger = screen.getByRole('button', { name: 'Interested in joining our cleaning team?' })
    expect(trigger).toHaveFocus()
    accept(record)
    await waitFor(() => expect(dialog).toHaveClass('is-success'))
    expect(trigger).toHaveFocus()
    await openModal(user)
    expect(screen.getByRole('heading', { name: "We've received your application." })).toHaveFocus()
  })

  it('leaves an existing customer waitlist confirmation intact', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'customer@example.com')
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(await screen.findByRole('heading', { name: /on the list/i })).toBeInTheDocument()
    await openModal(user)
    await user.click(screen.getByRole('button', { name: 'Close application form' }))
    expect(screen.getByRole('heading', { name: /on the list/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'ZIP code (optional)' })).toBeInTheDocument()
  })
})
