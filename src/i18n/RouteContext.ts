import { createContext, useContext } from 'react'
import { resolveSiteRoute } from './routes'
export const SiteRouteContext = createContext(resolveSiteRoute('/'))
export function useSiteRoute() { return useContext(SiteRouteContext) }
