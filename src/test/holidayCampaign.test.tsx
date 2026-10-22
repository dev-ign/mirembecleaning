import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { holidayCampaign, holidayCtaDismissedKey } from '../config/campaigns'

const campaign = holidayCampaign as unknown as { enabled: boolean }
const modal = () => document.querySelector<HTMLDialogElement>('.holiday-modal')!

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
  campaign.enabled = true
  localStorage.setItem('holiday-2026.modalSeen', '1')
  sessionStorage.removeItem(holidayCtaDismissedKey)
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
})

afterEach(() => {
  campaign.enabled = true
  localStorage.removeItem('holiday-2026.modalSeen')
  sessionStorage.removeItem(holidayCtaDismissedKey)
  vi.useRealTimers()
})

function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)) }

describe('holiday promotion page-load behavior', () => {
  it('opens after four seconds despite legacy localStorage and only once per load', () => {
    render(<App />)
    expect(document.querySelector('.holiday-floating-cta')).not.toBeNull()
    advance(3999)
    expect(modal()).not.toHaveAttribute('open')
    advance(1)
    expect(modal()).toHaveAttribute('open')
    expect(document.querySelector('.holiday-floating-cta')).toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Close holiday cleaning promotion' }))
    expect(modal()).not.toHaveAttribute('open')
    expect(document.querySelector('.holiday-floating-cta')).not.toBeNull()
    advance(10000)
    expect(modal()).not.toHaveAttribute('open')
  })

  it('opens again after a fresh load for a returning visitor', () => {
    const first = render(<App />)
    advance(4000)
    expect(modal()).toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Maybe Later' }))
    first.unmount()
    render(<App />)
    advance(3999)
    expect(modal()).not.toHaveAttribute('open')
    advance(1)
    expect(modal()).toHaveAttribute('open')
  })

  it('defers while another dialog is open and opens after it closes', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Join the Waitlist' })[0])
    expect(document.querySelector('.waitlist-dialog')).toHaveAttribute('open')
    advance(4000)
    expect(modal()).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Close waitlist' }))
    await act(async () => { await Promise.resolve() })
    expect(modal()).toHaveAttribute('open')
  })

  it('waits for mobile navigation and an active form interaction', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    advance(4000)
    expect(modal()).not.toHaveAttribute('open')

    const form = document.createElement('form')
    const input = document.createElement('input')
    form.append(input)
    document.body.append(form)
    input.focus()
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(modal()).not.toHaveAttribute('open')

    input.blur()
    advance(150)
    expect(modal()).toHaveAttribute('open')
    form.remove()
  })

  it('does not interrupt a holiday booking click during this load', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: /Book a holiday cleaning/ }))
    advance(4000)
    expect(modal()).not.toHaveAttribute('open')
  })

  it('keeps CTA dismissal independent of future modal display', () => {
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss holiday cleaning promotion' }))
    expect(sessionStorage.getItem(holidayCtaDismissedKey)).toBe('1')
    first.unmount()
    render(<App />)
    expect(document.querySelector('.holiday-floating-cta')).toBeNull()
    advance(4000)
    expect(modal()).toHaveAttribute('open')
  })

  it('renders neither promotion when the centralized campaign switch is off', () => {
    campaign.enabled = false
    render(<App />)
    expect(document.querySelector('.holiday-floating-cta')).toBeNull()
    expect(document.querySelector('.holiday-modal')).toBeNull()
    advance(5000)
    expect(document.querySelector('.holiday-modal')).toBeNull()
  })
})
