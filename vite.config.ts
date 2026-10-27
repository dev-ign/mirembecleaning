import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Match Vercel's exact document rewrites in local development and preview.
function pageDocuments(req: { url?: string }, res: { writeHead: (code: number, headers: Record<string, string>) => void; end: () => void }, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '')
  if (path === '/booking/thank-you') {
    res.writeHead(308, { Location: `/booking/thankyou${url.search}` })
    res.end()
    return
  }
  if (path === '/booking' || path === '/booking/thankyou' || path === '/terms' || path === '/privacy') req.url = `${path}/index.html${url.search}`
  next()
}

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'page-documents',
    configureServer(server) { server.middlewares.use(pageDocuments) },
    configurePreviewServer(server) { server.middlewares.use(pageDocuments) },
  }],
  build: {
    rollupOptions: {
      input: ['index.html', 'booking/index.html', 'booking/thankyou/index.html', 'terms/index.html', 'privacy/index.html'],
    },
  },
})
