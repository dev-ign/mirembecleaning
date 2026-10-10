import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

const mobileQuery = '(max-width: 1023px)'

export function FounderNote() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileQuery).matches)
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
        aria-label={expanded ? 'Close the founders note' : 'Read a note from our founders'}
        aria-expanded={expanded}
        aria-controls="founder-content"
        onClick={() => expanded ? close() : setExpanded(true)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="m4 15 8-8 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id="founder-content" className="founder-content" inert={isMobile && !expanded} aria-hidden={isMobile && !expanded}>
      <div className="founder-story">
        <p className="founder-eyebrow">A note from our founders</p>
        <div className="founder-body">
          <h2 id="founder-heading" ref={headingRef} tabIndex={-1}>We Believe Peace Begins At Home.</h2>
          <div className="founder-paragraphs">
            <p>
              As homeowners, parents, and landlords, we know firsthand how difficult it can be to find cleaning help that's reliable, thoughtful, and fairly priced.
            </p>
            <p>
              So we created Mirembe—the cleaning company we always wished we could call. A family-owned business built on care, trust, and the belief that every home deserves a little more peace.
            </p>
            <p className="founder-meaning">“Mirembe” means peace and tranquility.</p>
          </div>
        </div>
      </div>
      <div className="founder-signature">
        <p>With care,</p>
        <p>Felix &amp; Bria</p>
        <p>Founders, Mirembe Cleaning Company</p>
      </div>
      </div>
      </aside>
    </>
  )
}
