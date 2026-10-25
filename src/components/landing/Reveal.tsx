import { useEffect, useRef, type CSSProperties, type PropsWithChildren } from 'react'

let observer: IntersectionObserver | null = null
function getObserver() {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.remove('reveal-pending')
      entry.target.classList.add('reveal-visible')
      observer?.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 })
  return observer
}

export function Reveal({ children, className = '', delay = 0, initial = false }: PropsWithChildren<{ className?: string; delay?: number; initial?: boolean }>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || initial || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (element.getBoundingClientRect().top < window.innerHeight * 0.94) return
    element.classList.add('reveal-pending')
    const active = getObserver()
    active.observe(element)
    return () => active.unobserve(element)
  }, [initial])
  return <div ref={ref} className={`landing-reveal ${initial ? 'reveal-visible' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>
}
