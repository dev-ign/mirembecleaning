import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { canonicalRedirect, documentFile, resolveSiteRoute, sitePages } from './src/i18n/routes'

// Serve the same exact documents/aliases as Vercel, with no wildcard SPA fallback.
function pageDocuments(output = '') {
  return (req: { url?: string; headers: { accept?: string } }, res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body?: string) => void }, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (/^\/(?:api|assets|src|node_modules|@vite|@react-refresh|@fs)(?:\/|$)/.test(url.pathname)) { next(); return }
    const redirect = canonicalRedirect(url.pathname)
    if (redirect) { res.writeHead(308, { Location: redirect + url.search }); res.end(); return }
    const route = resolveSiteRoute(url.pathname)
    if (route.found) { req.url = '/' + documentFile(route) + url.search; next(); return }
    // Static files stay with Vite; unknown document routes are actual HTTP 404s.
    if (!url.pathname.split('/').at(-1)?.includes('.') || url.pathname.endsWith('.html')) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' })
      res.end(readFileSync(output + '404.html', 'utf8')); return
    }
    next()
  }
}
export default defineConfig({
  appType: 'mpa',
  plugins: [react(), tailwindcss(), {
    name: 'page-documents',
    configureServer(server) { server.middlewares.use(pageDocuments()) },
    configurePreviewServer(server) { server.middlewares.use(pageDocuments('dist/')) },
  }],
  build: { rollupOptions: { input: [...sitePages.map(documentFile), '404.html'] } },
})
