import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'
import { business } from '../src/config/business.js'
import { publicRoutes, seo } from '../src/config/seo.js'
import { bookingLanguageStorageKey, languageStorageKey, localeCodes, locales } from '../src/i18n/config.js'
import { documentFile, resolveSiteRoute, routeRedirects, sitePages } from '../src/i18n/routes.js'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const mode = process.argv[2] === '--mode' ? process.argv[3] : 'production'
if (mode !== 'development' && mode !== 'production') throw new Error('Expected --mode development or --mode production')
const preview = mode === 'development' || Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')
const pages = [...sitePages, resolveSiteRoute('/404')]
const vite = await createServer({ mode, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { renderPage } = await vite.ssrLoadModule('/src/prerender.tsx')
  for (const page of pages) {
    const { markup, metadata, schema } = renderPage(page.path, preview)
    const escapedJson = JSON.stringify(schema).replace(/</g, '\\u003c')
    // ZenMaid still redirects to its unchanged language-neutral confirmation URL.
    // Restore only that return's functional preference; every language URL wins.
    const confirmationPreference = page.locale === 'en' && page.kind === 'confirmation' ? `
    <style>html[data-locale-redirect] #root { visibility: hidden; }</style>
    <script>(function(){try{var l=null;var p=${JSON.stringify(Object.fromEntries(localeCodes.map(code => [code, locales[code].pathPrefix])))};try{l=sessionStorage.getItem('${bookingLanguageStorageKey}')}catch(e){}if(!Object.prototype.hasOwnProperty.call(p,l)){try{l=localStorage.getItem('${languageStorageKey}')}catch(e){}}if(l!=='en'&&Object.prototype.hasOwnProperty.call(p,l)){location.replace(p[l]+'/booking/thankyou'+location.search+location.hash);document.documentElement.setAttribute('data-locale-redirect','')}}catch(e){}})()</script>` : ''
    const html = `<!doctype html>
<html lang="${metadata.htmlLang}"${preview ? ' data-indexing="noindex"' : ''}>
  <head>
    <meta charset="UTF-8" />${confirmationPreference}
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="referrer" content="origin" />
    <meta name="theme-color" content="${seo.themeColor}" />
    <meta name="description" content="${escapeHtml(metadata.description)}" />
    <meta name="robots" content="${metadata.robots}" />
    ${metadata.canonicalUrl ? `<link rel="canonical" href="${metadata.canonicalUrl}" />` : ''}
    ${metadata.alternates.map((alternate: { hreflang: string; href: string }) => `<link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />`).join('\n    ')}
    <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
    <link rel="stylesheet" href="/src/index.css" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(business.name)}" />
    <meta property="og:url" content="${metadata.socialUrl}" />
    <meta property="og:title" content="${escapeHtml(metadata.title)}" />
    <meta property="og:description" content="${escapeHtml(metadata.description)}" />
    <meta property="og:image" content="${seo.shareImageUrl}" />
    <meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />
    <meta property="og:image:width" content="1672" />
    <meta property="og:image:height" content="941" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />
    <meta name="twitter:image" content="${seo.shareImageUrl}" />
    <meta name="twitter:image:alt" content="${escapeHtml(metadata.imageAlt)}" />
    <script type="application/ld+json">${escapedJson}</script>
    <title>${escapeHtml(metadata.title)}</title>
  </head>
  <body>
    <div id="root">${markup}</div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
    const file = documentFile(page)
    mkdirSync(file.substring(0, file.lastIndexOf('/')) || '.', { recursive: true })
    writeFileSync(file, html.replace(/[ \t]+$/gm, ''))
  }
} finally { await vite.close() }

mkdirSync('public', { recursive: true })
writeFileSync('public/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', business.websiteUrl).href}\n`)
// HTML provides the sole hreflang cluster. Sitemap lists only indexable canonicals.
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicRoutes.map(route => `  <url><loc>${escapeHtml(new URL(route, business.websiteUrl).href)}</loc></url>`).join('\n')}\n</urlset>\n`)
// Keep exact Vercel document routes in sync with the same inventory as the build.
const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
config.redirects = [{ source: '/booking/thank-you/:path*', destination: '/booking/thankyou', permanent: true }, ...routeRedirects]
config.rewrites = sitePages.filter(page => page.path !== '/').map(page => ({ source: page.path, destination: '/' + documentFile(page) }))
writeFileSync('vercel.json', JSON.stringify(config, null, 2) + '\n')
for (const file of ['hero.png', 'hero.webp', 'icon.png', 'favicon.png']) readFileSync('public/' + file)
