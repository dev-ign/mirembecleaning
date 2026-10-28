import { t, useLocale } from '../i18n'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

const mobileQuery = '(max-width: 1023px)'

export function FounderNote() {
  useLocale()
  // Match the server render first; the media query updates interaction state after hydration.
  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const query = window.matchMedia(mobileQuery)
    const update = () => {
      setIsMobile(query.matches)
      if (!query.matches) setExpanded(false)
    }
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!isMobile || !expanded) return
    const previousOverflow = document.body.style.overflow
    const background = document.querySelectorAll<HTMLElement>('.site-header, .hero-content')
    background.forEach((element) => { element.inert = true })
    document.body.style.overflow = 'hidden'
    headingRef.current?.focus({ preventScroll: true })
    return () => {
      background.forEach((element) => { element.inert = false })
      document.body.style.overflow = previousOverflow
    }
  }, [isMobile, expanded])

  function close() {
    setExpanded(false)
    toggleRef.current?.focus({ preventScroll: true })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isMobile || !expanded) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      toggleRef.current?.focus()
    }
  }

  return (
    <>
      {isMobile && expanded && <div className="founder-scrim" aria-hidden="true" onClick={close} />}
      <aside
        className={'founder-note' + (expanded && isMobile ? ' is-expanded' : '')}
        aria-labelledby="founder-heading"
        role={isMobile && expanded ? 'dialog' : undefined}
        aria-modal={isMobile && expanded ? true : undefined}
        onKeyDown={handleKeyDown}
      >
      <button
        ref={toggleRef}
        className="founder-toggle"
        type="button"
        aria-label={expanded ? t('founderNote.close') : t('founderNote.open')}
        aria-expanded={expanded}
        aria-controls="founder-content"
        onClick={() => expanded ? close() : setExpanded(true)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="m4 15 8-8 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id="founder-content" className="founder-content" inert={isMobile && !expanded} aria-hidden={isMobile && !expanded}>
      <div className="founder-story">
        <p className="founder-eyebrow">{t('home.founders.eyebrow')}</p>
        <div className="founder-body">
          <h2 id="founder-heading" ref={headingRef} tabIndex={-1}>{t('founderNote.title')}</h2>
          <div className="founder-paragraphs">
            <p>
              {t('founderNote.experience')}</p>
            <p>
              {t('founderNote.mission')}</p>
            <p className="founder-meaning">{t('home.founders.meaning')}</p>
          </div>
        </div>
      </div>
      <div className="founder-signature">
        <p>{t('home.founders.signoff')}</p>
        <p>Felix &amp; Bria</p>
        <p>{t('home.founders.role')}</p>
      </div>
      </div>
      </aside>
    </>
  )
}
