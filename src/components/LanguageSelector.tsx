import { navigateLocale } from '../i18n/navigation'
import { localizedPath, type BasePath } from '../i18n/routes'
import { useSiteRoute } from '../i18n/RouteContext'
import { useHydrated } from '../lib/useHydrated'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { t, useLocale } from '../i18n'
import { languageStorageKey, localeCodes, locales, type SupportedLocale } from '../i18n/config'
import { trackLanguageChange } from '../lib/optionalEvents'

export function LanguageSelector({ onOpen, mobileMenuOpen }: { onOpen: () => void; mobileMenuOpen: boolean }) {
  const locale = useLocale()
  const route = useSiteRoute()
  const hydrated = useHydrated()
  const suffix = hydrated ? window.location.search + window.location.hash : ''
  const [open, setOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  function close(restoreFocus = true) {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }
  function show(last = false) {
    onOpen()
    flushSync(() => setOpen(true))
    const buttons = menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    const selected = buttons?.[last ? buttons.length - 1 : Math.max(0, localeCodes.indexOf(locale))]
    selected?.focus({ preventScroll: true })
    // Scroll only the popover; scrollIntoView would also move the underlying page.
    const panel = menu.current
    if (selected && panel) {
      const bottom = selected.offsetTop + selected.offsetHeight
      if (selected.offsetTop < panel.scrollTop) panel.scrollTop = selected.offsetTop
      else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight
    }
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false)
        // Do not steal focus from the destination of an outside interaction.
        if (menu.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true })
      }
    }
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focus)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focus) }
  }, [open])
  // Native modal dialogs take precedence over this ordinary header popover.
  useEffect(() => {
    if (!open) return
    const observer = new MutationObserver(() => {
      if (document.querySelector('dialog[open]')) setOpen(false)
    })
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
    return () => observer.disconnect()
  }, [open])
  const visible = open && !mobileMenuOpen
  function select(next: SupportedLocale) {
    const previous = locale
    try { localStorage.setItem(languageStorageKey, next); setSaveFailed(false) } catch { setSaveFailed(true) }
    close()
    if (next !== previous) trackLanguageChange(previous, next)
    navigateLocale(next)
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    const buttons = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1
    if (next !== -1) { event.preventDefault(); buttons[next]?.focus(); return }
    // Native language names support first-letter navigation as well as arrows.
    if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
      const code = localeCodes.find(code => locales[code].label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()))
      if (code) { event.preventDefault(); buttons[localeCodes.indexOf(code)]?.focus() }
    }
  }
  return <div className="language-selector" ref={root} onKeyDown={event => { if (event.key === 'Escape' && visible) { event.preventDefault(); close() } }}>
    <button ref={trigger} className="language-trigger" type="button" aria-label={t('language.current', { language: locales[locale].label })} title={t('language.change')} aria-haspopup="menu" aria-expanded={visible} aria-controls={id}
      onClick={() => visible ? close() : show()} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp') }
      }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 6.5h14M5 17.5h14" /></svg>
      <span className="language-active-code" aria-hidden="true">{locales[locale].shortLabel}</span>
      <svg className="language-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {visible && <div ref={menu} id={id} className="language-menu" role="menu" aria-label={t('language.menu')} onKeyDown={navigate}>
      {localeCodes.map(code => <a href={localizedPath(route.found ? route.basePath as BasePath : '/', code) + suffix} key={code} role="menuitemradio" aria-checked={locale === code} tabIndex={-1} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); select(code) }} onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); select(code) } }}>
        <span aria-hidden="true">{locales[code].flag}</span><span className="language-code" aria-hidden="true">{locales[code].shortLabel}</span><span lang={locales[code].htmlLang}>{locales[code].label}</span><span className="language-check" aria-hidden="true">{locale === code ? '✓' : ''}</span>
      </a>)}
    </div>}
    {saveFailed && <p className="language-storage-notice" role="status">{t('language.saveFailed')}</p>}
  </div>
}
