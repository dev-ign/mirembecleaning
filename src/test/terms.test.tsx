import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { termsConfig } from '../config/legal'
import { loadZenMaid } from '../lib/zenmaid'

const policy = vi.hoisted(() => ({ privacyPolicyUrl: '', ga4Id: '', metaPixelId: '' }))
vi.mock('../config/marketing', () => ({ marketing: policy }))
vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn().mockResolvedValue(undefined) }))

beforeEach(() => {
  policy.privacyPolicyUrl = ''
  vi.mocked(loadZenMaid).mockClear()
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
})

const sourceLines = readFileSync('src/content/terms.txt', 'utf8').trim().split(/\r?\n/).filter(Boolean)
const renderedLines = (article: Element) => [...article.querySelectorAll('h1, h2, p, li')].map(element => element.textContent)

describe('approved Terms document', () => {
  it.each(['/terms', '/terms/', '/terms/index.html'])('renders every source line exactly and in order at %s', path => {
    render(<App path={path} />)
    const article = screen.getByRole('article', { name: termsConfig.title })
    expect(renderedLines(article)).toEqual(sourceLines)
    expect([...article.querySelectorAll('h2')].map(heading => heading.textContent)).toEqual(sourceLines.filter(line => /^\d+\. /.test(line)))
    expect(article.querySelectorAll('section')).toHaveLength(25)
    expect(article.querySelectorAll('ul')).toHaveLength(13)
    expect(article.querySelector('time')).toHaveAttribute('datetime', '2026-10-25')
    expect(article).toHaveTextContent('A returned payment fee of $[25] may be charged for declined or returned payments.')
    expect(loadZenMaid).not.toHaveBeenCalled()
    expect(screen.getByRole('main')).toContainElement(article)
    expect(screen.getByRole('navigation', { name: 'Main navigation' }).querySelector('a[href="/#services"]')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Legal' }).querySelector('a[href="/terms"]')).not.toHaveAttribute('target')
    expect(article.querySelector('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:hello@mirembecleaning.com')
    expect(article.querySelector('a[href^="tel:"]')).toHaveTextContent('617-917-4137')
    expect(article.querySelector('a[href^="tel:"]')).toHaveAttribute('href', 'tel:+16179174137')
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument()
  })

  it('links existing configured privacy policy references without changing any legal wording', () => {
    policy.privacyPolicyUrl = 'https://www.mirembecleaning.com/privacy'
    render(<App path="/terms" />)
    const article = screen.getByRole('article')
    expect(renderedLines(article)).toEqual(sourceLines)
    expect(article.querySelectorAll('a[href="https://www.mirembecleaning.com/privacy"]')).toHaveLength(2)
    expect(screen.getByRole('navigation', { name: 'Legal' }).querySelectorAll('a')).toHaveLength(2)
  })

  it('places a secure new-tab Terms review before booking fields without a second consent form', () => {
    render(<App path="/booking" />)
    const disclosure = document.querySelector<HTMLParagraphElement>('.booking-terms')!
    expect(disclosure).toHaveTextContent('Review our Terms of Service')
    expect(disclosure).toHaveTextContent('before booking.')
    const link = disclosure.querySelector('a')!
    expect(link).toHaveAttribute('href', termsConfig.path)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAccessibleName('Terms of Service (opens in a new tab)')
    expect(document.querySelector('.booking-intro')).toContainElement(disclosure)
    expect(disclosure.compareDocumentPosition(document.querySelector('.zenmaid-container')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.querySelector('.booking-embed .booking-terms')).toBeNull()
    expect(document.querySelector('.booking-embed input[type="checkbox"]')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Legal' }).querySelector('a')).not.toHaveAttribute('target')
  })

  it('prerenders the entire source for direct and indexable production navigation', () => {
    const page = new DOMParser().parseFromString(readFileSync('terms/index.html', 'utf8'), 'text/html')
    const article = page.querySelector('article')!
    expect(renderedLines(article)).toEqual(sourceLines)
    expect(page.querySelector('title')?.textContent).toBe(termsConfig.title)
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://www.mirembecleaning.com/terms')
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow')
    const rewrites = JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites
    expect(rewrites).toContainEqual({ source: '/terms', destination: '/terms/index.html' })
    expect(page.querySelector('script[src*="zenmaid"]')).toBeNull()
  })
})
