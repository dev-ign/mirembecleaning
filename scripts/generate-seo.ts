import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { business } from '../src/config/business.js'
import { privacyConfig, termsConfig } from '../src/config/legal.js'
import { pageTitle, publicRoutes, seo, structuredData } from '../src/config/seo.js'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)
const escapedJson = JSON.stringify(structuredData()).replace(/</g, '\\u003c')
const mode = process.argv[2] === '--mode' ? process.argv[3] : 'production'
if (mode !== 'development' && mode !== 'production') throw new Error('Expected --mode development or --mode production')

// Vite resolves the same TSX and asset imports used by the browser build.
// Hydration then keeps this complete DOM and its entrance animations in place.
const vite = await createServer({ mode, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const pages = [
  { path: '/', file: 'index.html', title: seo.title, description: seo.description, robots: 'index,follow,max-image-preview:large' },
  { path: '/booking', file: 'booking/index.html', title: pageTitle('/booking'), description: 'Request your holiday cleaning with Mirembe Cleaning Company. Our team will follow up to confirm availability.', robots: 'noindex,follow' },
  { path: '/booking/thankyou', file: 'booking/thankyou/index.html', title: pageTitle('/booking/thankyou'), description: 'Thank you for requesting a cleaning. Our team will review your request and contact you to confirm availability.', robots: 'noindex,follow' },
  { path: termsConfig.path, file: 'terms/index.html', title: termsConfig.title, description: 'Read the Mirembe Cleaning Company Terms of Service for residential and rental property cleaning services. Last updated October 25, 2026.', robots: 'index,follow' },
  { path: privacyConfig.path, file: 'privacy/index.html', title: privacyConfig.title, description: 'Read the Mirembe Cleaning Company Privacy Policy, effective October 26, 2026, covering service requests, applications, communications, and optional tracking.', robots: privacyConfig.approved ? 'index,follow' : 'noindex,nofollow' },
] as const
const renderedPages: Array<{ page: (typeof pages)[number]; markup: string }> = []
try {
  const { default: App } = await vite.ssrLoadModule('/src/App.tsx')
  for (const page of pages) renderedPages.push({ page, markup: renderToString(createElement(App, { path: page.path })) })
} finally {
  await vite.close()
}

for (const { page, markup } of renderedPages) {
  const canonicalUrl = page.path === '/' ? seo.canonicalUrl : new URL(page.path, business.websiteUrl).href
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="origin" />
    <meta name="theme-color" content="${seo.themeColor}" />
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="${page.robots}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
    <link rel="stylesheet" href="/src/index.css" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(business.name)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:image" content="${seo.shareImageUrl}" />
    <meta property="og:image:alt" content="A bright, peaceful home interior" />
    <meta property="og:image:width" content="1672" />
    <meta property="og:image:height" content="941" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${seo.shareImageUrl}" />
    <meta name="twitter:image:alt" content="A bright, peaceful home interior" />
    <script type="application/ld+json">${escapedJson}</script>
    <title>${escapeHtml(page.title)}</title>
  </head>
  <body>
    <div id="root">${markup}</div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`

  mkdirSync(page.file.substring(0, page.file.lastIndexOf('/')) || '.', { recursive: true })
  writeFileSync(page.file, html)
}
mkdirSync('public', { recursive: true })
writeFileSync('public/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', business.websiteUrl).href}\n`)
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicRoutes.map((route) => `  <url><loc>${escapeHtml(new URL(route, business.websiteUrl).href)}</loc></url>`).join('\n')}\n</urlset>\n`)
// Guard against accidentally shipping stale public assets if this script is moved.
readFileSync('public/hero.png')
readFileSync('public/hero.webp')
readFileSync('public/icon.png')
readFileSync('public/favicon.png')
