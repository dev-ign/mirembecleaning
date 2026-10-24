import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Match Vercel's exact document rewrites in local development and preview.
function bookingDocuments(req: { url?: string }, _res: unknown, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/booking' || path === '/booking/thank-you') req.url = `${path}/index.html${url.search}`
  next()
}

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'booking-documents',
    configureServer(server) { server.middlewares.use(bookingDocuments) },
    configurePreviewServer(server) { server.middlewares.use(bookingDocuments) },
  }],
  build: {
    rollupOptions: {
      input: ['index.html', 'booking/index.html', 'booking/thank-you/index.html'],
    },
  },
})
