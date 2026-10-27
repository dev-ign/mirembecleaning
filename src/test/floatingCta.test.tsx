import { renderToString } from 'react-dom/server'
import { TrackingPreferencesButton } from '../components/AnalyticsConsent'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HolidayFloatingCTA } from '../components/landing/HolidayCampaign'

afterEach(() => vi.unstubAllGlobals())

it('removes the CTA and its focus targets while the footer is visible and restores it afterwards', () => {
  sessionStorage.clear()
  let notify: IntersectionObserverCallback = () => {}
  const observe = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback }
    observe = observe
    disconnect() {}
  })
  const { unmount } = render(<><footer className="landing-footer">Legal links</footer><HolidayFloatingCTA hidden={false} onBooking={() => {}} /></>)
  expect(observe).toHaveBeenCalledWith(document.querySelector('footer'))
  expect(screen.getByRole('button', { name: 'Dismiss holiday cleaning promotion' })).toBeInTheDocument()
  act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(screen.queryByRole('link', { name: /Book a holiday cleaning/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dismiss holiday cleaning promotion' })).not.toBeInTheDocument()
  act(() => notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss holiday cleaning promotion' }))
  expect(sessionStorage.getItem('holiday-2026.ctaDismissed')).toBe('1')
  unmount()
})

it('yields to form entry without discarding the visitor’s dismissal preference', () => {
  sessionStorage.clear()
  render(<><form><input aria-label="Test field" /></form><HolidayFloatingCTA hidden={false} onBooking={() => {}} /></>)
  const field = screen.getByRole('textbox', { name: 'Test field' })
  act(() => field.focus())
  expect(screen.queryByRole('button', { name: 'Dismiss holiday cleaning promotion' })).not.toBeInTheDocument()
  act(() => field.blur())
  expect(screen.getByRole('button', { name: 'Dismiss holiday cleaning promotion' })).toBeInTheDocument()
  expect(sessionStorage.getItem('holiday-2026.ctaDismissed')).toBeNull()
})

it('includes the footer preferences action in prerendered HTML without relying on client effects', () => {
  expect(renderToString(<TrackingPreferencesButton />)).toContain('aria-haspopup="dialog">Tracking preferences</button>')
})
