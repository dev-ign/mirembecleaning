import { t, useLocale } from '../i18n'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

type WidgetId = string

interface TurnstileApi {
  render: (container: HTMLElement, options: {
    sitekey: string
    action: string
    appearance: 'interaction-only'
    theme: 'light'
    callback: (token: string) => void
    'expired-callback': () => void
    'timeout-callback': () => void
    'error-callback': () => void
  }) => WidgetId | undefined
  reset: (widgetId: WidgetId) => void
  remove: (widgetId: WidgetId) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export type TurnstileStatus = 'loading' | 'ready' | 'verified' | 'expired' | 'error'
export interface TurnstileWidgetHandle { reset: () => void }

interface TurnstileWidgetProps {
  action: 'waitlist' | 'applicants'
  onStatusChange: (status: TurnstileStatus, token?: string) => void
}

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.dataset.turnstileScript = 'true'
    const timer = window.setTimeout(() => fail(), 15_000)

    function fail() {
      window.clearTimeout(timer)
      script.remove()
      scriptPromise = null
      reject(new Error('Turnstile did not load'))
    }
    script.onload = () => {
      window.clearTimeout(timer)
      if (window.turnstile) resolve(window.turnstile)
      else fail()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return scriptPromise
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ action, onStatusChange }, ref) {
    useLocale()
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<WidgetId | null>(null)
    const apiRef = useRef<TurnstileApi | null>(null)
    const [attempt, setAttempt] = useState(0)

    useImperativeHandle(ref, () => ({
      reset() {
        onStatusChange('loading')
        if (apiRef.current && widgetIdRef.current) apiRef.current.reset(widgetIdRef.current)
        else setAttempt((current) => current + 1)
      },
    }), [onStatusChange])

    useEffect(() => {
      const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
      if (!sitekey) {
        onStatusChange('error')
        return
      }

      let disposed = false
      void loadTurnstile().then((api) => {
        if (disposed || !containerRef.current) return
        apiRef.current = api
        onStatusChange('ready')
        const widgetId = api.render(containerRef.current, {
          sitekey,
          action,
          appearance: 'interaction-only',
          theme: 'light',
          callback: (token) => onStatusChange('verified', token),
          'expired-callback': () => onStatusChange('expired'),
          'timeout-callback': () => onStatusChange('expired'),
          'error-callback': () => onStatusChange('error'),
        })
        if (widgetId) widgetIdRef.current = widgetId
        else onStatusChange('error')
      }).catch(() => { if (!disposed) onStatusChange('error') })

      return () => {
        disposed = true
        if (apiRef.current && widgetIdRef.current) apiRef.current.remove(widgetIdRef.current)
        widgetIdRef.current = null
        apiRef.current = null
        onStatusChange('loading')
      }
    }, [action, attempt, onStatusChange])

    return <div ref={containerRef} className="turnstile-widget" role="group" aria-label={t('common.security')} />
  },
)
