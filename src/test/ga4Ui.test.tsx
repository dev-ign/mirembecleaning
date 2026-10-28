import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from '../App'
import { pageTitle } from '../config/seo'

vi.mock('../config/marketing', () => ({ marketing: { ga4Id: 'G-TEST123', metaPixelId: '39772457375733047', privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy' } }))
vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn().mockResolvedValue(undefined) }))

it('dispatches once per changed route with updated titles under StrictMode, retaining footer consent controls', async () => {
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/')
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
  const events = () => window.dataLayer?.filter(entry => entry[0] === 'event' && entry[1] === 'page_view') ?? []
  const view = render(<StrictMode><App /></StrictMode>)
  expect(document.getElementById('mirembe-ga4')).toBeNull()
  fireEvent.click(await screen.findByRole('button', { name: 'Allow tracking' }))
  await waitFor(() => expect(events()).toHaveLength(1))
  let count = 1
  for (const route of ['/booking', '/booking/thankyou', '/terms', '/privacy', '/']) {
    history.pushState(null, '', route)
    view.rerender(<StrictMode><App path={route} /></StrictMode>)
    count++
    await waitFor(() => expect(events()).toHaveLength(count))
    expect(events().at(-1)?.[2]).toMatchObject({ page_path: route, page_title: pageTitle(route) })
    view.rerender(<StrictMode><App path={route} /></StrictMode>)
    expect(events()).toHaveLength(count)
  }
  expect(document.querySelectorAll('#mirembe-ga4')).toHaveLength(1)
  expect(window.dataLayer?.filter(entry => entry[1] === 'booking_complete')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Tracking preferences' }))
  expect(screen.getByRole('button', { name: 'Close tracking preferences' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  expect(window.dataLayer?.some(entry => entry[0] === 'consent' && entry[1] === 'update' && (entry[2] as Record<string, string>).analytics_storage === 'denied')).toBe(true)
  view.unmount()
})
