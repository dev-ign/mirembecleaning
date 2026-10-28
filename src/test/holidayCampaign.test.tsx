import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { HolidayFloatingCTA } from '../components/landing/HolidayCampaign'
import { holidayCampaign, holidayCtaDismissedKey } from '../config/campaigns'

vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn().mockResolvedValue(undefined) }))

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
  it('yields floating space to visible hero conversion actions and returns after they leave', () => {
    const observers: { callback: IntersectionObserverCallback; elements: Element[] }[] = []
    vi.stubGlobal('IntersectionObserver', class {
      record: typeof observers[number]
      constructor(callback: IntersectionObserverCallback) { this.record = { callback, elements: [] }; observers.push(this.record) }
      observe(element: Element) { this.record.elements.push(element) }
      disconnect() {}
    })
    try {
      const view = render(<><div className="landing-hero-actions" /><HolidayFloatingCTA hidden={false} onBooking={vi.fn()} /></>)
      const observer = observers.find(item => item.elements.some(element => element.matches('.landing-hero-actions')))!
      expect(document.querySelector('.holiday-floating-cta')).not.toBeNull()
      act(() => observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
      expect(document.querySelector('.holiday-floating-cta')).toBeNull()
      act(() => observer.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
      expect(document.querySelector('.holiday-floating-cta')).not.toBeNull()
      view.unmount()
    } finally { vi.unstubAllGlobals() }
  })
  it.each(['/terms', '/booking', '/booking/thank-you'])('never mounts promotional controls or delayed overlays on %s', path => {
    render(<App path={path} />)
    advance(60_000)
    expect(document.querySelector('.holiday-floating-cta,.holiday-modal')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close holiday cleaning promotion', hidden: true })).not.toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('cancels a pending home promotion when entering Terms and keeps home eligibility on return', () => {
    const view = render(<App />)
    advance(3000)
    view.rerender(<App path="/terms" />)
    advance(60_000)
    expect(document.querySelector('.holiday-floating-cta,.holiday-modal')).toBeNull()
    view.rerender(<App />)
    expect(document.querySelector('.holiday-floating-cta')).not.toBeNull()
    advance(3999)
    expect(modal()).not.toHaveAttribute('open')
    advance(1)
    expect(modal()).toHaveAttribute('open')
  })

  it('unmounts an open home modal and releases its scroll lock on a protected route', () => {
    const view = render(<App />)
    advance(4000)
    expect(modal()).toHaveAttribute('open')
    expect(document.body.style.overflow).toBe('hidden')
    view.rerender(<App path="/booking/thank-you" />)
    advance(60_000)
    expect(document.querySelector('.holiday-floating-cta,.holiday-modal')).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
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
    const link = screen.getByRole('link', { name: /Book a holiday cleaning/ })
    link.addEventListener('click', event => event.preventDefault()) // jsdom has no document navigation.
    fireEvent.click(link)
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
