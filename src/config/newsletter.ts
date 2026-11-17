// Public in production output; local development retains its explicit preview opt-in.
// MODE also covers the Vite SSR prerenderer, whose DEV flag can remain true.
export const newsletterEnabled = import.meta.env.MODE === 'production'
  || (import.meta.env.DEV && import.meta.env.MODE === 'development'
    && import.meta.env.VITE_ENABLE_NEWSLETTER_PREVIEW === 'true')
