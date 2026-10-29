import { renderToString } from 'react-dom/server'
import App from './App'
import { initializeRouteLocale } from './i18n/navigation'
import { resolveSiteRoute } from './i18n/routes'
import { localizedStructuredData, pageMetadata } from './i18n/seo'

export function renderPage(path: string, preview: boolean) {
  initializeRouteLocale(path)
  const route = resolveSiteRoute(path)
  return {
    markup: renderToString(<App path={path} />),
    metadata: pageMetadata(route, preview),
    schema: localizedStructuredData(route),
  }
}
