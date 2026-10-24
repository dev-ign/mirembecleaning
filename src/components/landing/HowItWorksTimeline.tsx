import { useEffect, useRef } from 'react'
import { timelineProgress } from '../../lib/timelineProgress'

type Step = readonly [title: string, body: string]

export function HowItWorksTimeline({ steps }: { steps: readonly Step[] }) {
  const ref = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const timeline = ref.current
    if (!timeline) return
    const nodes = [...timeline.querySelectorAll<HTMLElement>('.landing-step-node')]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    const update = () => {
      frame = 0
      const bounds = timeline.getBoundingClientRect()
      const centers = nodes.map(node => {
        const rect = node.getBoundingClientRect()
        return rect.top + rect.height / 2 - bounds.top
      })
      const railTop = centers[0] ?? 0
      const railHeight = (centers[centers.length - 1] ?? railTop) - railTop
      timeline.style.setProperty('--rail-top', `${railTop}px`)
      timeline.style.setProperty('--rail-height', `${railHeight}px`)
      const progress = reducedMotion.matches ? 1 : timelineProgress(bounds.top + railTop, railHeight, window.innerHeight)
      timeline.style.setProperty('--steps-progress', String(progress))
      const reached = progress >= 1 ? steps.length - 1 : progress >= 0.5 ? 1 : 0
      timeline.querySelectorAll<HTMLLIElement>('li').forEach((step, index) => {
        step.dataset.state = reducedMotion.matches ? 'complete' : index < reached ? 'complete' : index === reached ? 'active' : 'inactive'
      })
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule)
    observer?.observe(timeline)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    reducedMotion.addEventListener?.('change', schedule)
    if (document.fonts) void document.fonts.ready.then(schedule)
    schedule()
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      reducedMotion.removeEventListener?.('change', schedule)
    }
  }, [steps])

  return <ol ref={ref} className="landing-steps">{steps.map(([title, body], index) => <li key={title} className={index === 1 ? 'is-left' : 'is-right'} data-state={index === 0 ? 'active' : 'inactive'}><span className="landing-step-node" aria-hidden="true" /><div className="landing-step-content"><span className="landing-step-number">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
}
