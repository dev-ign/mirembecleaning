import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { NewsletterSignupSection } from '../components/landing/NewsletterSignupSection'
import { i18n, resources, t } from '../i18n'
import { localeCodes, locales } from '../i18n/config'
import { NewsletterRequestError, subscribeToNewsletter } from '../services/newsletterService'
import type { TurnstileStatus } from '../components/TurnstileWidget'

vi.mock('../services/newsletterService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/newsletterService')>()
  return { ...actual, subscribeToNewsletter: vi.fn() }
})
const widget = vi.hoisted(() => ({ status: 'verified' as TurnstileStatus, change: undefined as undefined | ((status: TurnstileStatus, token?: string) => void), reset: vi.fn() }))
vi.mock('../components/TurnstileWidget', async () => {
  const { forwardRef, useEffect, useImperativeHandle } = await import('react')
  return { TurnstileWidget: forwardRef(function MockWidget({ action, onStatusChange }: { action: string; onStatusChange: (status: TurnstileStatus, token?: string) => void }, ref) {
    useEffect(() => { widget.change = onStatusChange; onStatusChange(widget.status, 'synthetic-token') }, [onStatusChange])
    useImperativeHandle(ref, () => ({ reset() { widget.reset(); onStatusChange('loading') } }), [onStatusChange])
    return <div role="group" aria-label="Security verification" data-action={action} />
  }) }
})

afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); vi.restoreAllMocks(); vi.unstubAllGlobals(); widget.status = 'verified'; widget.reset.mockClear(); vi.mocked(subscribeToNewsletter).mockReset() })

describe('newsletter signup', () => {
  it.each(localeCodes)('renders accessible %s signup copy and a localized privacy link', async code => {
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
    expect(input).toHaveAccessibleDescription(expect.stringContaining(t('newsletter.ready')))
    expect(within(form).getByRole('button', { name: t('newsletter.subscribe') })).toBeEnabled()
    expect(within(form).getByRole('link')).toHaveAttribute('href', locales[code].pathPrefix + '/privacy')
    expect(document.getElementById('newsletter-disclosure')).toHaveTextContent(resources[code]['newsletter.disclosure'].replace(/<[^>]*>/g, ''))
    expect(within(form).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it.each(localeCodes)('offers the shared newsletter after the booking acknowledgment in %s', async code => {
    vi.mocked(subscribeToNewsletter).mockResolvedValueOnce()
    const copy = resources[code]
    const prefix = locales[code].pathPrefix
    await i18n.changeLanguage(code)
    render(<App path={`${prefix}/booking/thankyou`} />)

    const confirmation = screen.getByRole('heading', { level: 1 })
    const newsletter = screen.getByRole('region', { name: copy['newsletter.bookingTitle'] })
    const form = within(newsletter).getByRole('form', { name: copy['newsletter.bookingTitle'] })
    const input = within(form).getByRole('textbox', { name: copy['newsletter.emailLabel'] })
    expect(confirmation).toHaveFocus()
    expect(confirmation.compareDocumentPosition(newsletter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(copy['booking.thankYou.message'])).toBeInTheDocument()
    expect(within(newsletter).getByText(copy['newsletter.bookingDescription'])).toBeInTheDocument()
    expect(within(form).getByRole('link')).toHaveAttribute('href', `${prefix}/privacy`)
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Mirembe Cleaning'))
    expect(within(form).getByRole('status')).toBeEmptyDOMElement()
    expect(input).toHaveValue('')
    expect(subscribeToNewsletter).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'synthetic@example.test' } })
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
    fireEvent.click(within(form).getByRole('button', { name: copy['newsletter.subscribe'] }))
    expect(subscribeToNewsletter).toHaveBeenCalledExactlyOnceWith('synthetic@example.test', code, 'synthetic-token')
    await waitFor(() => expect(within(form).getByRole('status')).toHaveTextContent(copy['newsletter.acknowledged']))
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

  it('holds loading, latches repeated submits and shows neutral acknowledgment only after success', async () => {
    let resolve!: () => void
    vi.mocked(subscribeToNewsletter).mockReturnValue(new Promise<void>(done => { resolve = done }))
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(<NewsletterSignupSection />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'synthetic@example.test' } })
    fireEvent.submit(screen.getByRole('form'))
    fireEvent.submit(screen.getByRole('form'))
    expect(subscribeToNewsletter).toHaveBeenCalledExactlyOnceWith('synthetic@example.test', 'en', 'synthetic-token')
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: t('newsletter.submitting') })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(t('newsletter.submitting'))
    expect(screen.queryByText(t('newsletter.acknowledged'))).not.toBeInTheDocument()
    await act(async () => resolve())
    expect(screen.getByRole('status')).toHaveTextContent(t('newsletter.acknowledged'))
    expect(screen.getByRole('button', { name: t('newsletter.subscribe') })).toBeDisabled()
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
    fireEvent.submit(screen.getByRole('form'))
    expect(subscribeToNewsletter).toHaveBeenCalledTimes(1)
    expect(storageSpy).not.toHaveBeenCalled()
  })

  it.each(localeCodes)('localizes acknowledged and request error states in %s', async locale => {
    await i18n.changeLanguage(locale)
    vi.mocked(subscribeToNewsletter).mockRejectedValueOnce(new NewsletterRequestError('unavailable')).mockResolvedValueOnce()
    render(<NewsletterSignupSection />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'synthetic@example.test' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent(resources[locale]['newsletter.requestError'])
    expect(screen.getByRole('textbox')).toHaveValue('synthetic@example.test')
    expect(widget.reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: t('newsletter.subscribe') })).toBeDisabled()
    act(() => widget.change?.('verified', 'retry-token'))
    fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(resources[locale]['newsletter.acknowledged']))
    expect(subscribeToNewsletter).toHaveBeenLastCalledWith('synthetic@example.test', locale, 'retry-token')
  })

  it('blocks invalid input and expired verification, and permits a security retry', () => {
    render(<NewsletterSignupSection />)
    expect(screen.getByRole('group')).toHaveAttribute('data-action', 'newsletter')
    fireEvent.submit(screen.getByRole('form'))
    expect(screen.getByRole('textbox')).toHaveFocus()
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'synthetic@example.test' } })
    act(() => widget.change?.('expired'))
    fireEvent.submit(screen.getByRole('form'))
    expect(subscribeToNewsletter).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(t('newsletter.verificationError'))
    fireEvent.click(screen.getByRole('button', { name: t('newsletter.retryVerification') }))
    expect(widget.reset).toHaveBeenCalledTimes(1)
  })

  it('renders the public newsletter before FAQ without an environment visibility flag', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<App path="/" />)
    const section = screen.queryByRole('region', { name: t('newsletter.title') })
    const faq = document.getElementById('faq')!
    const closing = document.querySelector('.landing-final-cta')!
    const main = document.querySelector('main')!
    expect(section).toBeInTheDocument()
    expect(section?.nextElementSibling).toBe(faq)
    expect(faq.nextElementSibling).toBe(closing)
    expect(main.lastElementChild).toBe(closing)
    expect(document.querySelector('.landing-footer')?.previousElementSibling).toBe(main)
    expect(document.querySelector('.landing-footer .team-link')).toHaveTextContent(t('hiring.link'))
  })
})
