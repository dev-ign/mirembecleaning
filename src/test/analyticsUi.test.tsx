import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from '../App'
import { loadZenMaid } from '../lib/zenmaid'

vi.mock('../config/marketing', () => ({ marketing: { ga4Id: '', metaPixelId: '39772457375733047', privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy' } }))
vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn() }))

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
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  fireEvent.click(screen.getByRole('button', { name: 'Allow tracking' }))
  expect(events('PageView')).toHaveLength(1)
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
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  expect(commands()).toContainEqual(['consent', 'revoke'])
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  expect(screen.getByRole('button', { name: 'Allow tracking' })).toBeVisible()
  view.unmount()
  vi.unstubAllGlobals()
})
