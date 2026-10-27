import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { ZenMaidEmbed } from '../components/booking/ZenMaidEmbed'
import { loadZenMaid } from '../lib/zenmaid'
import { bookingConfig } from '../config/booking'
import { safePageLocation } from '../lib/analytics/attribution'

vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn() }))

beforeEach(() => {
  vi.mocked(loadZenMaid).mockReset().mockResolvedValue(undefined)
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
})
afterEach(() => { window.history.replaceState({}, '', '/') })

describe('booking documents', () => {
  it('mounts the container before initializing, including Strict Mode, and observes rendered fields', async () => {
    vi.mocked(loadZenMaid).mockImplementation(() => {
      expect(document.querySelector('.zenmaid-container')).toBeInTheDocument()
      return Promise.resolve()
    })
    render(<StrictMode><ZenMaidEmbed /></StrictMode>)
    // Script onload is not treated as proof that the form rendered.
    await screen.findByText(/Your booking form is being prepared/)
    await act(async () => {
      const form = document.createElement('form')
      const token = document.createElement('input')
      token.type = 'hidden'
      form.append(token)
      document.querySelector('.zenmaid-container')!.append(form)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Your booking form is being prepared')
    await act(async () => {
      document.querySelector('.zenmaid-container form')!.append(document.createElement('input'))
    })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(document.querySelectorAll('.zenmaid-container form')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Open secure booking/ })).toHaveAttribute('href', bookingConfig.holiday.hostedUrl)
  })

  it('keeps both supported fallbacks available when the external script fails', async () => {
    vi.mocked(loadZenMaid).mockRejectedValue(new Error('blocked'))
    render(<ZenMaidEmbed />)
    await screen.findByText(/The booking form couldn’t load/)
    screen.getByText('More options').click()
    expect(screen.getByRole('link', { name: 'Try the simple form' })).toHaveAttribute('href', '/booking?embed=basic')
    expect(screen.getByRole('link', { name: /Open secure booking/ })).toHaveAttribute('href', bookingConfig.holiday.hostedUrl)
  })

  it('uses the official basic iframe without starting the Advanced loader', async () => {
    window.history.replaceState({}, '', '/booking?embed=basic')
    render(<ZenMaidEmbed />)
    expect(screen.getByTitle('Mirembe Cleaning booking form')).toHaveAttribute('src', bookingConfig.holiday.basicEmbedUrl)
    expect(loadZenMaid).not.toHaveBeenCalled()
    expect(screen.queryByText('Loading your booking form…')).not.toBeInTheDocument()
  })

  it('renders branded request and confirmation routes with the existing navigation', async () => {
    const view = render(<App path="/booking" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Book Your Holiday Cleaning')
    expect(screen.queryByText(/Submitting a booking request does not guarantee/)).not.toBeInTheDocument()
    expect(screen.getByText(/Request your holiday cleaning below/)).toBeInTheDocument()
    expect(screen.getByText(/All Mirembe cleaners are background-checked, insured, and bonded/)).toBeInTheDocument()
    const phone = screen.getByRole('link', { name: 'Call (617) 917-4137' })
    expect(phone).toHaveAttribute('href', 'tel:+16179174137')
    expect(screen.getByRole('link', { name: '(617) 917-4137' })).toHaveAttribute('href', 'tel:+16179174137')
    const fallback = screen.getByRole('link', { name: /Open secure booking/ })
    expect(fallback).toHaveAttribute('target', '_blank')
    expect(fallback).toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.querySelector('.zenmaid-container')!.compareDocumentPosition(document.querySelector('.booking-provider-help')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.querySelector('.booking-request-note')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Request a Cleaning/ })).toHaveAttribute('href', bookingConfig.path)
    expect(screen.getByRole('link', { name: /Request a Cleaning/ })).not.toHaveAttribute('target')
    expect(screen.getByRole('navigation', { name: 'Main navigation' }).querySelector('a[href="/#services"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Interested in joining our cleaning team?' })).toBeInTheDocument()
    await screen.findByText(/Your booking form is being prepared/)
    view.unmount()
    vi.mocked(loadZenMaid).mockClear()
    window.history.replaceState({}, '', '/booking/thank-you/')
    render(<App path="/booking/thank-you/" />)
    expect(window.location.pathname).toBe('/booking/thankyou')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your Cleaning Request Is In')
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/')
    expect(screen.getByText(/our team will reach out to confirm the details/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Request a Cleaning/ })).toHaveAttribute('href', bookingConfig.path)
    expect(screen.getByRole('link', { name: /Request a Cleaning/ })).not.toHaveAttribute('target')
    expect(screen.getByRole('link', { name: 'Explore Our Services' })).toHaveAttribute('href', '/#services')
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(loadZenMaid).not.toHaveBeenCalled()
    expect(document.querySelector('.zenmaid-container')).not.toBeInTheDocument()
  })

  it('keeps analytics locations limited to known routes and approved campaign values', () => {
    window.history.replaceState({}, '', '/booking?embed=basic&email=private@example.com&utm_source=holiday')
    expect(safePageLocation(window.location.search)).toBe(`${window.location.origin}/booking?utm_source=holiday`)
    window.history.replaceState({}, '', '/booking/thank-you')
    expect(safePageLocation('')).toBe(`${window.location.origin}/booking/thankyou`)
  })
})
