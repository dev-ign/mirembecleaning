import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent } from '../lib/optionalEvents'
import { WaitlistExperience } from '../components/WaitlistExperience'
import { createWaitlistEntry, updateWaitlistZip } from '../services/waitlistService'
import type { WaitlistRecord } from '../types/waitlist'

vi.mock('../lib/optionalEvents', () => ({ trackEvent: vi.fn() }))

let autoVerifyWaitlist = true
let emitWaitlistVerification: ((status: string, token?: string) => void) | undefined

vi.mock('../components/TurnstileWidget', async () => {
  const { forwardRef, useEffect, useImperativeHandle } = await import('react')
  return {
    TurnstileWidget: forwardRef<{ reset: () => void }, { onStatusChange: (status: string, token?: string) => void }>(function MockTurnstile({ onStatusChange }, ref) {
      emitWaitlistVerification = onStatusChange
      useImperativeHandle(ref, () => ({ reset: () => { onStatusChange('loading'); onStatusChange('verified', 'retry-token') } }), [onStatusChange])
      useEffect(() => { onStatusChange('ready'); if (autoVerifyWaitlist) onStatusChange('verified', 'test-token') }, [onStatusChange])
      return null
    }),
  }
})

vi.mock('../services/waitlistService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/waitlistService')>()
  return { ...actual, createWaitlistEntry: vi.fn(), updateWaitlistZip: vi.fn() }
})

const createdRecord: WaitlistRecord = {
  id: 'existing-record',
  email: 'person@example.com',
  zip_code: null,
  zip_token: 'test-zip-token',
  source: 'landing_page',
  created_at: '2026-10-10T14:00:00.000Z',
}

async function joinWaitlist(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), 'person@example.com')
  await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
  return screen.findByRole('heading', { name: /on the list/i })
}

describe('waitlist experience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autoVerifyWaitlist = true
    emitWaitlistVerification = undefined
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })
    vi.mocked(createWaitlistEntry).mockResolvedValue(createdRecord)
    vi.mocked(updateWaitlistZip).mockImplementation(async ({ zip_code }) => ({ ...createdRecord, zip_code }))
  })

  it('waits for verification without an error and retries failed or expired checks', async () => {
    autoVerifyWaitlist = false
    const user = userEvent.setup()
    render(<WaitlistExperience />)
    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    expect(screen.getByRole('button', { name: 'Verifying...' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(createWaitlistEntry).not.toHaveBeenCalled()

    act(() => emitWaitlistVerification?.('error'))
    expect(screen.getByRole('alert')).toHaveTextContent('Verification could not load')
    await user.click(screen.getByRole('button', { name: 'Retry verification' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => emitWaitlistVerification?.('expired'))
    expect(screen.getByRole('button', { name: 'Retry verification' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Retry verification' }))
    expect(createWaitlistEntry).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(createWaitlistEntry).toHaveBeenCalledExactlyOnceWith(expect.any(Object), 'retry-token')
  })

  it('rejects empty and invalid email without creating a record', async () => {
    const user = userEvent.setup()
    render(<WaitlistExperience />)

    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(screen.getByRole('alert')).toHaveTextContent('valid email')
    await user.type(screen.getByLabelText('Email address'), 'invalid')
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(screen.getByRole('alert')).toHaveTextContent('valid email')
    expect(createWaitlistEntry).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalledWith('waitlist_signup_success', expect.anything())
    expect(screen.queryByRole('heading', { name: /on the list/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Privacy Policy/ })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /Privacy Policy/ })).toHaveAttribute('target', '_blank')
  })

  it('normalizes email and submits via Enter once', async () => {
    const user = userEvent.setup()
    render(<WaitlistExperience />)
    const email = screen.getByLabelText('Email address')
    fireEvent.change(email, { target: { value: '  Person@Example.com  ' } })
    await user.type(email, '{enter}')

    expect(createWaitlistEntry).toHaveBeenCalledExactlyOnceWith({ email: 'person@example.com', source: 'landing_page' }, 'test-token')
    const heading = await screen.findByRole('heading', { name: /on the list/i })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('blocks duplicate submissions while the create request is pending', async () => {
    const user = userEvent.setup()
    let finishCreate!: (record: WaitlistRecord) => void
    vi.mocked(createWaitlistEntry).mockReturnValueOnce(new Promise((resolve) => { finishCreate = resolve }))
    render(<WaitlistExperience />)

    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /joining/i }))
    expect(createWaitlistEntry).toHaveBeenCalledTimes(1)

    finishCreate(createdRecord)
    expect(await screen.findByRole('heading', { name: /on the list/i })).toBeInTheDocument()
    expect(vi.mocked(trackEvent).mock.calls.filter(([name]) => name === 'waitlist_signup_success')).toEqual([['waitlist_signup_success', createdRecord.id]])
  })

  it('acknowledges an existing subscriber without a conversion', async () => {
    vi.mocked(createWaitlistEntry).mockResolvedValueOnce({ ...createdRecord, id: null, zip_token: null, created_at: null })
    const user = userEvent.setup()
    render(<WaitlistExperience />)
    await joinWaitlist(user)
    expect(trackEvent).not.toHaveBeenCalledWith('waitlist_signup_success', expect.anything())
  })

  it('shows a create error and permits retry', async () => {
    const user = userEvent.setup()
    vi.mocked(createWaitlistEntry).mockRejectedValueOnce(new Error('offline'))
    render(<WaitlistExperience />)

    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again')
    expect(trackEvent).not.toHaveBeenCalledWith('waitlist_signup_success', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(await screen.findByRole('heading', { name: /on the list/i })).toBeInTheDocument()
    expect(createWaitlistEntry).toHaveBeenCalledTimes(2)
    expect(createWaitlistEntry).toHaveBeenNthCalledWith(1, expect.any(Object), 'test-token')
    expect(createWaitlistEntry).toHaveBeenNthCalledWith(2, expect.any(Object), 'retry-token')
  })

  it('shows the full success state only after create succeeds, with focus and optional ZIP', async () => {
    const user = userEvent.setup()
    const { container } = render(<WaitlistExperience />)
    expect(screen.queryByRole('heading', { name: /on the list/i })).not.toBeInTheDocument()

    const heading = await joinWaitlist(user)
    expect(heading).toHaveFocus()
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
    expect(screen.getByText(/when booking opens/i)).toBeInTheDocument()
    expect(screen.getByLabelText('ZIP code (optional)')).toBeInTheDocument()
    expect(container.querySelector('.success-icon img')).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
    expect(container.querySelector('.success-check-trace')).toBeInTheDocument()
    expect(updateWaitlistZip).not.toHaveBeenCalled()
  })

  it('validates ZIP, preserves leading zeros, and saves against the existing record ID', async () => {
    const user = userEvent.setup()
    const { container } = render(<WaitlistExperience />)
    await joinWaitlist(user)
    const zip = screen.getByLabelText('ZIP code (optional)')
    const save = screen.getByRole('button', { name: 'Save' })

    expect(save).toBeDisabled()
    await user.type(zip, '0210')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent('five-digit ZIP')
    expect(updateWaitlistZip).not.toHaveBeenCalled()

    await user.type(zip, '8')
    expect(save).toBeEnabled()
    await user.type(zip, '{enter}')
    const savedMessage = await screen.findByText('Zip code saved. Thank you!')
    expect(savedMessage).toHaveFocus()
    expect(screen.queryByLabelText('ZIP code (optional)')).not.toBeInTheDocument()
    expect(container.querySelector('.zip-collection.is-exiting')).not.toBeInTheDocument()
    expect(container.querySelector('.zip-saved-state img')).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
    expect(updateWaitlistZip).toHaveBeenCalledExactlyOnceWith({ record: createdRecord, zip_code: '02108' })
    expect(createWaitlistEntry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: /on the list/i })).toBeInTheDocument()
  })

  it('lets visitors edit and resave ZIP on the same record', async () => {
    const user = userEvent.setup()
    const { container } = render(<WaitlistExperience />)
    await joinWaitlist(user)
    const icon = container.querySelector('.success-icon')
    await user.type(screen.getByLabelText('ZIP code (optional)'), '02108')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Zip code saved. Thank you!')
    await user.click(screen.getByRole('button', { name: 'Edit ZIP' }))
    const zip = screen.getByLabelText('ZIP code (optional)')
    expect(zip).toHaveValue('02108')
    expect(zip).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.clear(zip)
    await user.type(zip, '06001')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Zip code saved. Thank you!')

    expect(updateWaitlistZip).toHaveBeenNthCalledWith(1, { record: createdRecord, zip_code: '02108' })
    expect(updateWaitlistZip).toHaveBeenNthCalledWith(2, { record: { ...createdRecord, zip_code: '02108' }, zip_code: '06001' })
    expect(createWaitlistEntry).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.success-icon')).toBe(icon)
    await user.click(screen.getByRole('button', { name: 'Edit ZIP' }))
    expect(screen.getByLabelText('ZIP code (optional)')).toHaveValue('06001')
  })

  it('cancels a ZIP edit without another service call', async () => {
    const user = userEvent.setup()
    render(<WaitlistExperience />)
    await joinWaitlist(user)
    await user.type(screen.getByLabelText('ZIP code (optional)'), '02108')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Zip code saved. Thank you!')

    await user.click(screen.getByRole('button', { name: 'Edit ZIP' }))
    const zip = screen.getByLabelText('ZIP code (optional)')
    await user.clear(zip)
    await user.type(zip, '06001')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Zip code saved. Thank you!')).toHaveFocus()
    expect(screen.queryByLabelText('ZIP code (optional)')).not.toBeInTheDocument()
    expect(updateWaitlistZip).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Edit ZIP' }))
    expect(screen.getByLabelText('ZIP code (optional)')).toHaveValue('02108')
  })

  it('prevents rapid duplicate ZIP updates while saving', async () => {
    const user = userEvent.setup()
    let finishUpdate!: (record: WaitlistRecord) => void
    vi.mocked(updateWaitlistZip).mockReturnValueOnce(new Promise((resolve) => { finishUpdate = resolve }))
    render(<WaitlistExperience />)
    await joinWaitlist(user)
    await user.type(screen.getByLabelText('ZIP code (optional)'), '02108')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const saving = screen.getByRole('button', { name: /saving/i })
    expect(saving).toHaveAttribute('aria-disabled', 'true')
    expect(saving).toHaveFocus()
    await user.click(saving)
    expect(updateWaitlistZip).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Zip code saved. Thank you!')).not.toBeInTheDocument()

    finishUpdate({ ...createdRecord, zip_code: '02108' })
    expect(await screen.findByText('Zip code saved. Thank you!')).toHaveFocus()
  })

  it('keeps the main confirmation mounted while the ZIP group exits and shrinks', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
    const { container } = render(<WaitlistExperience />)
    await joinWaitlist(user)
    const icon = container.querySelector('.success-icon')

    await user.type(screen.getByLabelText('ZIP code (optional)'), '02108')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(container.querySelector('.zip-collection.is-exiting')).toHaveAttribute('inert'))
    expect(screen.queryByText('Zip code saved. Thank you!')).not.toBeInTheDocument()
    expect(await screen.findByText('Zip code saved. Thank you!')).toHaveFocus()
    expect(container.querySelector('.success-icon')).toBe(icon)
    expect(container.querySelector('.zip-collection')).not.toBeInTheDocument()
  })

  it('keeps the exiting email form inert until the transition completes', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
    const { container } = render(<WaitlistExperience />)

    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    await waitFor(() => expect(container.querySelector('.waitlist-email-stage')).toHaveAttribute('inert'))
    expect(screen.queryByRole('heading', { name: /on the list/i })).not.toBeInTheDocument()
    const heading = await screen.findByRole('heading', { name: /on the list/i })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('keeps registration successful after a ZIP error and allows retry', async () => {
    const user = userEvent.setup()
    vi.mocked(updateWaitlistZip).mockRejectedValueOnce(new Error('offline'))
    render(<WaitlistExperience />)
    await joinWaitlist(user)

    const zip = screen.getByLabelText('ZIP code (optional)')
    await user.type(zip, '02108')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t save')
    expect(zip).toHaveValue('02108')
    expect(screen.getByRole('heading', { name: /on the list/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Zip code saved. Thank you!')).toBeInTheDocument()
    expect(createWaitlistEntry).toHaveBeenCalledTimes(1)
  })
})
