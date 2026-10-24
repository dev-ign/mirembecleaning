import { bookingConfig } from '../config/booking'

declare global {
  interface Window { zenmaid?: unknown[][] }
}

let scriptLoad: Promise<void> | undefined
const scriptId = 'mirembe-zenmaid-loader'

// One queue and script per document. Booking links use document navigation:
// the vendor reads its queue once and does not document an SPA remount API.
export function loadZenMaid(): Promise<void> {
  if (scriptLoad) return scriptLoad
  scriptLoad = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing?.dataset.state === 'loaded') { resolve(); return }
    if (existing?.dataset.state === 'error') { reject(new Error('Booking script unavailable')); return }

    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => { script.dataset.state = 'loaded'; resolve() }, { once: true })
    script.addEventListener('error', () => { script.dataset.state = 'error'; reject(new Error('Booking script unavailable')) }, { once: true })
    if (existing) return

    window.zenmaid ??= []
    window.zenmaid.push(['js', new Date()], ['config', bookingConfig.holiday.formId])
    script.id = scriptId
    script.src = bookingConfig.scriptUrl
    script.async = true
    document.head.appendChild(script)
  })
  return scriptLoad
}
