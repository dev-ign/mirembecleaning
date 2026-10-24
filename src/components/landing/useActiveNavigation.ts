import { useEffect, useState } from 'react'

export const navigationSections = [
  { id: 'services', label: 'Services' },
  { id: 'why-mirembe', label: 'Why Mirembe' },
  { id: 'areas', label: 'Areas We Serve' },
  { id: 'faq', label: 'FAQ' },
] as const

type SectionId = (typeof navigationSections)[number]['id']

export function useActiveNavigation(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null)

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const sections = navigationSections.map(({ id }) => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section))
    const header = document.querySelector<HTMLElement>('.landing-header')
    let observer: IntersectionObserver | null = null

    const observe = () => {
      observer?.disconnect()
      const visible = new Set<string>()
      const activationTop = Math.max(0, Math.min(Math.round((header?.getBoundingClientRect().height ?? 101) + 24), window.innerHeight - 8))
      const bottomMargin = Math.max(0, window.innerHeight - activationTop - 8)
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        setActive(navigationSections.find(({ id }) => visible.has(id))?.id ?? null)
      }, { rootMargin: `-${activationTop}px 0px -${bottomMargin}px 0px` })
      sections.forEach(section => observer?.observe(section))
    }

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(observe)
    if (header) resizeObserver?.observe(header)
    window.addEventListener('resize', observe)
    observe()
    return () => {
      observer?.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', observe)
    }
  }, [])

  return active
}
