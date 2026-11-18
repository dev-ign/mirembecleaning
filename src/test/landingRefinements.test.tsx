import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { bookingConfig } from '../config/booking'
import { i18n, t } from '../i18n'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
})

afterEach(async () => { cleanup(); await i18n.changeLanguage('en') })

describe('landing navigation and booking actions', () => {
  it('keeps the four semantic section links pointed at their existing targets', () => {
    render(<App />)
    for (const [label, id] of [['Services', 'services'], ['Why Mirembe', 'why-mirembe'], ['Areas We Serve', 'areas'], ['FAQ', 'faq']]) {
      expect(screen.getByRole('navigation', { name: 'Main navigation' }).querySelector(`a[href="#${id}"]`)).toHaveTextContent(label)
      expect(document.getElementById(id)).toBeInTheDocument()
    }
  })

  it('uses same-tab booking navigation for every general request link and service drawer', () => {
    render(<App />)
    const requests = screen.getAllByRole('link', { name: /Request a Cleaning/i })
    // Both responsive header presentations share the existing booking destination.
    expect(requests).toHaveLength(6)
    for (const link of requests) {
      expect(link).toHaveAttribute('href', bookingConfig.path)
      expect(link).not.toHaveAttribute('target')
      expect(link).not.toHaveAttribute('rel')
    }
    const serviceTriggers = screen.getAllByRole('button', { name: /What’s included in/ })
    expect(serviceTriggers).toHaveLength(3)
    for (const trigger of serviceTriggers) {
      fireEvent.click(trigger)
      const drawerLink = screen.getAllByRole('link', { name: /Request a Cleaning/i }).at(-1)!
      expect(drawerLink).toHaveAttribute('href', bookingConfig.path)
      expect(drawerLink).not.toHaveAttribute('target')
      expect(drawerLink).not.toHaveAttribute('rel')
      expect(screen.getByRole('button', { name: 'Back to services' })).toBeInTheDocument()
      // Keep jsdom on this document while checking the existing dismissal callback.
      drawerLink.addEventListener('click', event => event.preventDefault(), { once: true })
      fireEvent.click(drawerLink)
      expect(document.querySelector('.service-detail-dialog')).not.toHaveAttribute('open')
    }
  })

  it('keeps waitlist, hiring, and holiday actions distinct', () => {
    render(<App />)
    expect(screen.getAllByRole('button', { name: 'Join the Waitlist' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Interested in joining our cleaning team?' })).toBeInTheDocument()
    const holiday = screen.getByRole('link', { name: /Book a holiday cleaning/ })
    expect(holiday).toHaveAttribute('href', bookingConfig.path)
    expect(holiday).not.toHaveAttribute('target')
  })

  it('keeps one primary hero action, availability and supporting content without recruitment or waitlist promotions', () => {
    render(<App />)
    const hero = document.querySelector('.landing-hero') as HTMLElement
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('A Cleaner Home, More Peace.')
    const booking = within(hero).getByRole('link', { name: 'Request a Cleaning' })
    expect(booking).toHaveClass('landing-button', 'is-primary')
    expect(booking).toHaveAttribute('href', bookingConfig.path)
    expect(hero.querySelectorAll('.landing-button')).toHaveLength(1)
    expect(within(hero).queryByRole('button')).not.toBeInTheDocument()
    expect(hero).not.toHaveTextContent('Looking for cleaning work?')
    expect(hero.querySelector('.landing-cta-group, .landing-hero-pathways, .landing-hero-hiring')).toBeNull()
    expect(hero.querySelector('.landing-availability')).toHaveTextContent('January 2027')
    expect(hero.querySelector('.landing-hero-lede')).not.toBeEmptyDOMElement()
    expect(hero.querySelector('.landing-hero-trust')).not.toBeEmptyDOMElement()
    expect(hero.querySelectorAll('.landing-quick-facts li')).toHaveLength(3)
  })


})


describe('service area cleanup', () => {
  it('ends at the two service cards while keeping global waitlist entry points', async () => {
    await i18n.changeLanguage('en')
    render(<App path="/" />)
    const section = document.getElementById('areas')!
    expect(section.querySelectorAll('.landing-area-card')).toHaveLength(2)
    expect(section.querySelectorAll('.landing-map img')).toHaveLength(2)
    expect(section.querySelectorAll('.landing-area-badge').length).toBeGreaterThan(2)
    expect(section.querySelector('.landing-container')?.lastElementChild).toHaveClass('landing-area-grid')
    expect(section.querySelector('button')).toBeNull()
    expect(document.querySelector('.landing-area-prompt')).toBeNull()
    expect(screen.getAllByRole('button', { name: t('waitlist.join') }).length).toBeGreaterThan(0)
  })
})
