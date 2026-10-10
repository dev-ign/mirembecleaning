import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WaitlistExperience } from '../components/WaitlistExperience'
import { createWaitlistEntry, updateWaitlistZip } from '../services/waitlistService'
import type { WaitlistRecord } from '../types/waitlist'

vi.mock('../services/waitlistService', () => ({
  createWaitlistEntry: vi.fn(),
  updateWaitlistZip: vi.fn(),
}))

const createdRecord: WaitlistRecord = {
  id: 'existing-record',
  email: 'person@example.com',
  zip_code: null,
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
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })
    vi.mocked(createWaitlistEntry).mockResolvedValue(createdRecord)
    vi.mocked(updateWaitlistZip).mockImplementation(async ({ zip_code }) => ({ ...createdRecord, zip_code }))
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
    expect(screen.queryByRole('heading', { name: /on the list/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument()
  })

  it('normalizes email and submits via Enter once', async () => {
    const user = userEvent.setup()
    render(<WaitlistExperience />)
    const email = screen.getByLabelText('Email address')
    fireEvent.change(email, { target: { value: '  Person@Example.com  ' } })
    await user.type(email, '{enter}')

    expect(createWaitlistEntry).toHaveBeenCalledExactlyOnceWith({ email: 'person@example.com', source: 'landing_page' })
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
  })

  it('shows a create error and permits retry', async () => {
    const user = userEvent.setup()
    vi.mocked(createWaitlistEntry).mockRejectedValueOnce(new Error('offline'))
    render(<WaitlistExperience />)

    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again')
    await user.click(screen.getByRole('button', { name: 'Join the Waitlist' }))
    expect(await screen.findByRole('heading', { name: /on the list/i })).toBeInTheDocument()
    expect(createWaitlistEntry).toHaveBeenCalledTimes(2)
  })

  it('shows the full success state only after create succeeds, with focus and optional ZIP', async () => {
    const user = userEvent.setup()
    const { container } = render(<WaitlistExperience />)
    expect(screen.queryByRole('heading', { name: /on the list/i })).not.toBeInTheDocument()

    const heading = await joinWaitlist(user)
    expect(heading).toHaveFocus()
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
    expect(screen.getByText(/booking opens in January 2027/i)).toBeInTheDocument()
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
    expect(updateWaitlistZip).toHaveBeenCalledExactlyOnceWith({ id: createdRecord.id, zip_code: '02108' })
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

    expect(updateWaitlistZip).toHaveBeenNthCalledWith(1, { id: createdRecord.id, zip_code: '02108' })
    expect(updateWaitlistZip).toHaveBeenNthCalledWith(2, { id: createdRecord.id, zip_code: '06001' })
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
