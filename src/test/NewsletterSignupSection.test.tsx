import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { NewsletterSignupSection } from '../components/landing/NewsletterSignupSection'
import { i18n, resources, t } from '../i18n'
import { localeCodes, locales } from '../i18n/config'

const preview = vi.hoisted(() => ({ enabled: true }))
vi.mock('../config/newsletter', () => ({ get newsletterPreviewEnabled() { return preview.enabled } }))

afterEach(async () => { cleanup(); preview.enabled = true; await i18n.changeLanguage('en'); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('newsletter frontend preview', () => {
  it.each(localeCodes)('renders accessible, unavailable %s signup copy and a localized privacy link', async code => {
    await i18n.changeLanguage(code)
    render(<div className="landing-page"><NewsletterSignupSection /></div>)
    const form = screen.getByRole('form', { name: t('newsletter.title') })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(resources[code]['newsletter.title'])
    expect(screen.getByText(t('newsletter.description'))).toBeInTheDocument()
    const input = within(form).getByRole('textbox', { name: t('newsletter.emailLabel') })
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('autocomplete', 'email')
    expect(input).toHaveAttribute('inputmode', 'email')
    expect(input).toHaveAttribute('placeholder', t('newsletter.emailPlaceholder'))
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription(expect.stringContaining(t('newsletter.unavailable')))
    expect(within(form).getByRole('button', { name: t('newsletter.subscribe') })).toBeDisabled()
    expect(within(form).getByRole('link')).toHaveAttribute('href', locales[code].pathPrefix + '/privacy')
    expect(document.getElementById('newsletter-disclosure')).toHaveTextContent(resources[code]['newsletter.disclosure'].replace(/<[^>]*>/g, ''))
    expect(within(form).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('associates localized empty/invalid errors with the input and accepts a valid-looking address', async () => {
    const user = userEvent.setup()
    render(<NewsletterSignupSection />)
    const input = screen.getByRole('textbox', { name: 'Email address' })
    await user.click(input)
    await user.tab()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(t('newsletter.emailRequired'))
    expect(input).toHaveAccessibleDescription(expect.stringContaining(t('newsletter.emailRequired')))
    await act(() => i18n.changeLanguage('ht'))
    expect(screen.getByRole('alert')).toHaveTextContent(resources.ht['newsletter.emailRequired'])
    await user.type(input, 'not-an-email')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent(resources.ht['newsletter.emailInvalid'])
    await user.clear(input)
    await user.type(input, 'person+tips@example.test')
    await user.tab()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('blocks Enter and submit without network calls, stored email or a success state', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(window, 'fetch')
    const localSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<NewsletterSignupSection />)
    const form = screen.getByRole('form')
    await user.type(screen.getByRole('textbox'), 'synthetic@example.test{Enter}')
    expect(fireEvent.submit(form)).toBe(false)
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled()
    expect(screen.getByText(t('newsletter.unavailable'))).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(localSpy).not.toHaveBeenCalled()
  })

  it.each([true, false])('preserves newsletter → FAQ → closing CTA → footer with preview=%s', enabled => {
    preview.enabled = enabled
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<App path="/" />)
    const section = screen.queryByRole('region', { name: t('newsletter.title') })
    const faq = document.getElementById('faq')!
    const closing = document.querySelector('.landing-final-cta')!
    const main = document.querySelector('main')!
    if (enabled) expect(section?.nextElementSibling).toBe(faq)
    else {
      expect(section).not.toBeInTheDocument()
      expect(faq.previousElementSibling).toHaveClass('landing-founders')
    }
    expect(faq.nextElementSibling).toBe(closing)
    expect(main.lastElementChild).toBe(closing)
    expect(document.querySelector('.landing-footer')?.previousElementSibling).toBe(main)
    expect(document.querySelector('.landing-footer .team-link')).toHaveTextContent(t('hiring.link'))
  })
})
