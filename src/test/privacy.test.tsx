import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { privacyConfig } from '../config/legal'
import { privacyDocument } from '../content/privacy'
import { startAnalytics } from '../lib/analytics'
import { loadZenMaid } from '../lib/zenmaid'
import { WaitlistForm } from '../components/WaitlistForm'
import { HiringApplicationForm } from '../components/hiring/HiringApplicationForm'

vi.mock('../lib/zenmaid', () => ({ loadZenMaid: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../components/TurnstileWidget', () => ({ TurnstileWidget: () => null }))

// Independently pinned to the founder-supplied attachment, not the old draft.
const approvedHash = 'd06636fec1d4b653c7257fed6df32e5ef2604623104569bc33981997c8defd80'
const source = readFileSync('src/content/privacy.txt', 'utf8')
const sourceLines = source.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => line.replace(/^•\s*/, ''))
const renderedLines = (article: Element) => [...article.querySelectorAll('h1, h2, h3, p, li')].map(element => element.textContent?.trim())
const headings = [
  'Who we are', 'Information we collect', 'How we use information', 'Bookings and payments',
  'Your keys, access codes, and home', 'Emails and texts', 'Cleaner applicants',
  'Optional analytics and advertising', 'Cookies, browser storage, and your choices',
  'Companies that help us operate', 'When we share information', 'How long we keep information',
  'How we protect information', 'Your privacy choices and requests', 'Children’s privacy',
  'Other websites', 'Changes to this policy', 'Contact us',
].map((heading, index) => `${index + 1}. ${heading}`)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('founder-approved Privacy Policy', () => {
  it('keeps the public source byte-identical to the approved attachment', () => {
    expect(createHash('sha256').update(source).digest('hex')).toBe(approvedHash)
    expect(privacyDocument.title).toBe('Mirembe Cleaning Company Privacy Policy')
    expect(privacyDocument.effectiveDate).toBe('Effective date: October 26, 2026')
    expect(privacyDocument.sections.map(section => section.heading)).toEqual(headings)
  })

  it.each(['/privacy', '/privacy/', '/privacy/index.html'])('renders every approved text block exactly and in order at %s', path => {
    render(<App path={path} />)
    const article = screen.getByRole('article', { name: privacyConfig.title })
    expect(renderedLines(article)).toEqual(sourceLines)
    expect([...article.querySelectorAll('h2')].map(heading => heading.textContent)).toEqual(headings)
    expect(article.querySelectorAll('section')).toHaveLength(18)
    expect(article.querySelectorAll('h1')).toHaveLength(1)
    expect(article.querySelectorAll('h3')).toHaveLength(4)
    expect(article.querySelectorAll('li')).toHaveLength(source.split(/\r?\n/).filter(line => line.trim().startsWith('•')).length)
    expect(article.querySelector('time')).toHaveAttribute('datetime', '2026-10-26')
    expect(article).toHaveTextContent('Mirembe Cleaning Company LLC')
    expect(article).toHaveTextContent('We will respond within 30 days.')
    expect(article).toHaveTextContent('Payment and accounting records: 7 years, as required for tax purposes')
    expect(article.querySelector('a[href="mailto:hello@mirembecleaning.com"]')).not.toBeNull()
    expect(article.querySelector('a[href="tel:+16179174137"]')).toHaveTextContent('617-917-4137')
    expect(article.querySelector('.privacy-review-notice,.privacy-review-note')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Legal' }).querySelector('a[href="/privacy"]')).not.toBeNull()
    expect(document.querySelector('.holiday-floating-cta,.holiday-modal')).toBeNull()
    expect(loadZenMaid).not.toHaveBeenCalled()
  })

  it('approves the policy without treating approval as visitor consent', () => {
    expect(privacyConfig.approved).toBe(true)
    expect(privacyConfig.effectiveAt).toBe('2026-10-26')
    startAnalytics()
    expect(document.querySelector('#mirembe-meta-pixel,#mirembe-ga4')).toBeNull()
  })

  it('prerenders approved text and canonical metadata in the entry document', () => {
    const page = new DOMParser().parseFromString(readFileSync('privacy/index.html', 'utf8'), 'text/html')
    expect(renderedLines(page.querySelector('article')!)).toEqual(sourceLines)
    expect(page.querySelector('title')?.textContent).toBe(privacyConfig.title)
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://www.mirembecleaning.com/privacy')
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow')
    expect(page.querySelector('meta[name="description"]')?.getAttribute('content')).not.toMatch(/draft|pending/i)
    expect(page.querySelector('script[src*="zenmaid"],script[src*="fbevents"],script[src*="gtag"]')).toBeNull()
    expect(readFileSync('public/sitemap.xml', 'utf8')).toContain('<loc>https://www.mirembecleaning.com/privacy</loc>')
    expect(JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites).toContainEqual({ source: '/privacy', destination: '/privacy/index.html' })
  })

  // Fresh checkouts can run unit tests without a local ignored build directory.
  it.skipIf(!existsSync('dist/privacy/index.html'))('keeps production HTML identical to the approved source', () => {
    const page = new DOMParser().parseFromString(readFileSync('dist/privacy/index.html', 'utf8'), 'text/html')
    expect(renderedLines(page.querySelector('article')!)).toEqual(sourceLines)
    expect(page.querySelector('.privacy-review-notice,.privacy-review-note')).toBeNull()
  })

  it('provides disclosures without losing form entries or adding a privacy checkbox', () => {
    render(<><WaitlistForm onCreated={vi.fn()} exiting={false} onExitComplete={vi.fn()} /><HiringApplicationForm active={false} onAccepted={vi.fn()} /></>)
    const links = screen.getAllByRole('link', { name: 'Privacy Policy (opens in a new tab)' })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/privacy')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(screen.queryByRole('checkbox', { name: /privacy|agree|consent/i })).toBeNull()
  })
})
