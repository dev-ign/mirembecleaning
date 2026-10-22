import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { holidayCampaign } from '../config/campaigns'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
})

describe('landing navigation and booking actions', () => {
  it('keeps the four semantic section links pointed at their existing targets', () => {
    render(<App />)
    for (const [label, id] of [['Services', 'services'], ['Why Mirembe', 'why-mirembe'], ['Areas We Serve', 'areas'], ['FAQ', 'faq']]) {
      expect(screen.getByRole('navigation', { name: 'Main navigation' }).querySelector(`a[href="#${id}"]`)).toHaveTextContent(label)
      expect(document.getElementById(id)).toBeInTheDocument()
    }
  })

  it('uses the existing ZenMaid URL for every general request link and the service drawer', () => {
    render(<App />)
    const requests = screen.getAllByRole('link', { name: /Request a Cleaning/i })
    expect(requests).toHaveLength(5)
    for (const link of requests) {
      expect(link).toHaveAttribute('href', holidayCampaign.bookingUrl)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    fireEvent.click(screen.getByRole('button', { name: 'What’s included in Deep Clean' }))
    const drawerLink = screen.getAllByRole('link', { name: /Request a Cleaning/i }).at(-1)
    expect(drawerLink).toHaveAttribute('href', holidayCampaign.bookingUrl)
    expect(drawerLink).toHaveAttribute('target', '_blank')
    expect(drawerLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('button', { name: 'Back to services' })).toBeInTheDocument()
    fireEvent.click(drawerLink!)
    expect(document.querySelector('.service-detail-dialog')).not.toHaveAttribute('open')
  })

  it('keeps waitlist, hiring, and holiday actions distinct', () => {
    render(<App />)
    expect(screen.getAllByRole('button', { name: 'Join the Waitlist' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Interested in joining our cleaning team?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Book a holiday cleaning/ })).toHaveAttribute('href', holidayCampaign.bookingUrl)
  })
})
