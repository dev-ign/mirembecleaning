import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import App from '../App'
import { loadZenMaid } from '../lib/zenmaid'

vi.mock('../config/marketing', () => ({ marketing: { ga4Id: '', metaPixelId: '39772457375733047', privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy' } }))
vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn() }))

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
})

it('gates real UI interactions under StrictMode, observes form visibility, and allows withdrawal', async () => {
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/')
  delete window.fbq
  delete window._fbq
  document.getElementById('mirembe-meta-pixel')?.remove()
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  const intersections: Array<{ callback: IntersectionObserverCallback; element: Element }> = []
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(element: Element) { intersections.push({ callback: this.callback, element }) }
    unobserve() {}
    disconnect() {}
  })
  vi.mocked(loadZenMaid).mockImplementation(async () => {
    const container = document.querySelector('.zenmaid-container')!
    if (!container.querySelector('form')) {
      const form = document.createElement('form')
      form.append(document.createElement('input'))
      container.append(form)
    }
  })
  const events = (name: string) => window.fbq?.queue?.filter(entry => entry[2] === name) ?? []
  const commands = () => window.fbq?.queue ?? []
  const view = render(<StrictMode><App path="/" /></StrictMode>)
  expect(window.fbq).toBeUndefined()
  expect(screen.getByRole('group', { name: 'Optional tracking choice' }).querySelector('a')).toHaveAttribute('href', '/privacy')
  fireEvent.click(await screen.findByRole('button', { name: 'Decline' }))
  expect(window.fbq).toBeUndefined()
  const preferences = screen.getByRole('button', { name: 'Tracking preferences' })
  expect(preferences.closest('nav')).toHaveAttribute('aria-label', 'Legal')
  expect(document.querySelector('.analytics-consent,.analytics-settings')).toBeNull()
  fireEvent.click(preferences)
  expect(screen.getByRole('dialog', { name: 'Tracking preferences' })).toHaveTextContent('currently declined')
  expect(screen.getByRole('button', { name: 'Close tracking preferences' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Allow tracking' }))
  expect(preferences).toHaveFocus()
  await waitFor(() => expect(events('PageView')).toHaveLength(1))
  expect(commands().filter(entry => entry[0] === 'init')).toHaveLength(1)
  const request = screen.getAllByRole('link', { name: /Request a Cleaning/ })[0]
  request.addEventListener('click', event => event.preventDefault())
  fireEvent.click(request)
  await waitFor(() => expect(events('BookingCTA_Click')).toHaveLength(1))
  history.pushState(null, '', '/booking')
  view.rerender(<StrictMode><App path="/booking" /></StrictMode>)
  await waitFor(() => expect(document.querySelector('.booking-embed')).toHaveClass('is-ready'))
  expect(events('BookingFormView')).toHaveLength(0)
  const observer = [...intersections].reverse().find(item => item.element.classList.contains('zenmaid-container'))!
  observer.callback([{ target: observer.element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  observer.callback([{ target: observer.element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  expect(events('BookingFormView')).toHaveLength(1)
  expect(events('PageView')).toHaveLength(2)
  history.pushState(null, '', '/booking/thankyou')
  view.rerender(<StrictMode><App path="/booking/thankyou" /></StrictMode>)
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  expect(events('PageView')).toHaveLength(3)
  expect(events('Lead')).toHaveLength(0)
  expect(events('BookingRequestSubmitted')).toHaveLength(0)
  const eventCount = commands().length
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('currently allowed')
  expect(commands()).toHaveLength(eventCount)
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  expect(commands()).toContainEqual(['consent', 'revoke'])
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  expect(screen.getByRole('button', { name: 'Allow tracking' })).toBeVisible()
  view.unmount()
  vi.unstubAllGlobals()
})

it('keeps footer preferences available under Global Privacy Control without offering an override', () => {
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
  localStorage.clear()
  const view = render(<App path="/privacy" />)
  const preferences = screen.getByRole('button', { name: 'Tracking preferences' })
  fireEvent.click(preferences)
  const dialog = screen.getByRole('dialog', { name: 'Tracking preferences' })
  expect(dialog).toHaveTextContent('Your browser privacy setting blocks optional tracking.')
  expect(screen.queryByRole('button', { name: 'Allow tracking' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close tracking preferences' }))
  expect(preferences).toHaveFocus()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  view.unmount()
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
})

it('shows the persistence limitation and immediately withdraws despite a failed write', async () => {
  const consent = await import('../lib/consent')
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
  localStorage.setItem(consent.consentKey, 'accepted')
  const view = render(<App path="/" />)
  await waitFor(() => expect(window.fbq).toBeDefined())
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded') })
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  expect(consent.getConsent()).toBe('declined')
  expect(screen.getByRole('dialog')).toHaveTextContent('currently declined')
  expect(screen.getByRole('alert')).toHaveTextContent('may reset when you reload')
  expect(window.fbq?.queue).toContainEqual(['consent', 'revoke'])
  fireEvent.click(screen.getByRole('button', { name: 'Close tracking preferences' }))
  expect(screen.getByRole('button', { name: 'Tracking preferences' })).toHaveFocus()
  write.mockRestore()
  // Recover persistence for following tests; real visitors retain the warning until recovery/reload.
  consent.saveConsent('declined')
  view.unmount()
})

it('updates and revokes on a cross-tab storage change', async () => {
  const consent = await import('../lib/consent')
  localStorage.setItem(consent.consentKey, 'declined')
  const view = render(<App path="/privacy" />)
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('currently declined')
  localStorage.setItem(consent.consentKey, 'accepted')
  fireEvent(window, new StorageEvent('storage', { key: consent.consentKey, newValue: 'accepted' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('currently allowed'))
  localStorage.setItem(consent.consentKey, 'declined')
  fireEvent(window, new StorageEvent('storage', { key: consent.consentKey, newValue: 'declined' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('currently declined')
  expect(window.fbq?.queue).toContainEqual(['consent', 'revoke'])
  view.unmount()
})
