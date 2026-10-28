import React from 'react'
import { hydrateRoot } from 'react-dom/client'

import App from './App'
import { initializeRouteLocale } from './i18n/navigation'

initializeRouteLocale(window.location.pathname)

if (!document.documentElement.hasAttribute('data-locale-redirect')) hydrateRoot(document.getElementById('root')!,
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
