import { useCallback, useEffect, useRef, useState } from 'react'
import { BrandLogo } from '../BrandLogo'
import { CleaningTeamLink } from '../CleaningTeamLink'
import { AnalyticsConsent } from '../AnalyticsConsent'
import { business } from '../../config/business'
import { marketing } from '../../config/marketing'
import { trackEvent } from '../../lib/analytics'
import { Reveal } from './Reveal'
import { WaitlistModal } from './WaitlistModal'
import { ZipAvailability } from './ZipAvailability'

const photo = (name: string) => `/landing/${encodeURIComponent(name)}.webp`
const icon = (name: string) => `/landing/icons/${name}.svg`
function Icon({ name, className = '', eager = false }: { name: string; className?: string; eager?: boolean }) {
  return <img className={className} src={icon(name)} alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'} />
}
const services = [
  ['Recurring Home Cleaning', 'Reliable ongoing cleaning designed to keep your home consistently comfortable, on a schedule that fits your household.', 'Recurring Home Cleaning'],
  ['Deep Cleaning', 'A more detailed, top-to-bottom reset for homes that need extra attention — ideal before the holidays or a season change.', 'Sunlit Brass and Marble Kitchen'],
  ['Move-In Cleaning', 'Prepare a new home before you settle in, so the first night in your space already feels like yours.', 'Sunlit Modern Home Interior'],
  ['Move-Out Cleaning', 'Leave a home or rental clean and ready for what comes next — for you, your landlord, or the next family.', 'Sunlit Minimalist Apartment Interior'],
  ['Rental Turnover Cleaning', 'Cleaning support for landlords and rental properties between tenants or guests, so every arrival feels cared for.', 'Serene Lavender Bedroom Retreat'],
] as const
const benefits = [
  ['Thoughtful Service', 'Careful attention to your home and the people living in it.'],
  ['Reliable Cleaning', 'A dependable experience you can feel comfortable inviting into your home.'],
  ['Clear Communication', 'Know what to expect before, during, and after every service.'],
  ['Flexible Support', 'Cleaning designed around different homes, schedules, and needs.'],
] as const
const faqs = [
  ['What types of cleaning does Mirembe offer?', 'Mirembe Cleaning Company offers residential cleaning, including recurring home cleaning, deep cleaning, move-in cleaning, move-out cleaning, and rental turnover cleaning.'],
  ['Where does Mirembe Cleaning provide service?', 'We serve homes in Greater Boston, Massachusetts and the Newington, Connecticut area, along with surrounding communities. Join the waitlist for updates as availability opens.'],
  ['Can I book a one-time cleaning?', 'One-time cleaning details will be confirmed when booking opens. Join the waitlist for updates.'],
  ['Will recurring cleaning be available?', 'Recurring home cleaning is planned. Scheduling options will be confirmed when booking opens.'],
  ['How do I request a cleaning?', 'The request link and booking steps are being finalized. Join the waitlist and we’ll share them when they’re ready.'],
  ['What happens after I submit a request?', 'Our follow-up process is being finalized. We’ll share the details before requests open.'],
  ['Can I join the waitlist if my area isn’t available yet?', 'Yes. Join the waitlist and we’ll send launch updates as Mirembe expands to more communities.'],
  ['Is Mirembe hiring cleaners?', 'We’re building our cleaning team. Visit “Join the Team” to learn more and apply.'],
] as const

function WaitlistButton({ open, joined, variant = 'primary' }: { open: () => void; joined: boolean; variant?: 'primary' | 'secondary' | 'inverse' }) {
  return <button className={`landing-button is-${joined ? 'confirmed' : variant}`} type="button" disabled={joined} onClick={open} aria-haspopup={joined ? undefined : 'dialog'}>
    {joined ? <><Icon name="benefit-check" /> You’re on the waitlist</> : 'Join the Waitlist'}
  </button>
}
function RequestButton({ onClick, inverse = false }: { onClick: () => void; inverse?: boolean }) {
  return <button className={`landing-button is-primary${inverse ? ' is-on-dark' : ''}`} type="button" onClick={onClick} aria-label="Request Cleaning — booking link coming soon">Request Cleaning <Icon name={inverse ? 'button-arrow-on-dark' : 'button-arrow-light'} /></button>
}
function ServiceIcon({ index }: { index: number }) {
  return <Icon name={['service-repeat', 'service-sparkle', 'service-key', 'service-box', 'service-building'][index]} />
}
function SectionHeading({ eyebrow, title, description, id, center = false }: { eyebrow?: string; title: string; description?: string; id: string; center?: boolean }) {
  return <div className={`landing-section-heading${center ? ' is-centered' : ''}`}>
    {eyebrow && <p className="landing-eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2>{description && <p>{description}</p>}
  </div>
}
function Header({ open, joined, requestInfo }: { open: () => void; joined: boolean; requestInfo: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return <header className={`landing-header${scrolled ? ' is-scrolled' : ''}`}><div className="landing-header-inner">
    <a href="#top" aria-label="Mirembe Cleaning Company, back to top" className="landing-brand-link"><BrandLogo /></a>
    <button className="landing-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="landing-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : '☰'}</button>
    <nav id="landing-nav" className={`landing-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
      {[['Services', '#services'], ['Why Mirembe', '#why-mirembe'], ['Areas We Serve', '#areas'], ['FAQ', '#faq']].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
      <WaitlistButton open={() => { setMenuOpen(false); open() }} joined={joined} variant="secondary" />
      <RequestButton onClick={() => { setMenuOpen(false); requestInfo() }} />
    </nav>
  </div></header>
}
function Hero({ open, joined, requestInfo }: { open: () => void; joined: boolean; requestInfo: () => void }) {
  return <section className="landing-hero" id="top" aria-labelledby="hero-heading"><div className="landing-container landing-hero-grid">
    <div className="landing-hero-copy">
      <Reveal initial><p className="landing-availability"><Icon name="leaf" eager />Limited holiday availability in Massachusetts &amp; Connecticut</p></Reveal>
      <Reveal initial delay={80}><h1 id="hero-heading">A Cleaner Home.<span>More Peace.</span></h1></Reveal>
      <Reveal initial delay={160}><p className="landing-hero-lede">Thoughtful home cleaning in Greater Boston, Massachusetts and Newington, Connecticut—so you can come home to more peace.</p></Reveal>
      <Reveal initial delay={240}><div className="landing-hero-actions"><div className="landing-cta-group"><RequestButton onClick={requestInfo} /><WaitlistButton open={open} joined={joined} variant="secondary" /></div><p>Request a holiday cleaning now, or join the waitlist for our 2027 launch.</p></div></Reveal>
      <Reveal initial delay={320}><ul className="landing-quick-facts"><li><Icon name="home" eager />Residential cleaning</li><li><Icon name="map-pin" eager />Greater Boston, MA</li><li><Icon name="map-pin" eager />Newington, CT</li></ul></Reveal>
    </div>
    <Reveal initial delay={400} className="landing-hero-visual">
      <img className="landing-hero-photo" src={photo('Hero Image')} alt="Sunlit, peaceful living room" width="1560" height="1980" fetchPriority="high" />
      <img className="landing-hero-inset" src={photo('Cozy Mother-Daughter Reading Nook')} alt="Parent and child enjoying time together at home" width="1122" height="1402" loading="lazy" />
      <div className="landing-meaning-card"><strong>Mirembe</strong><span>peace · tranquility</span></div>
    </Reveal>
  </div></section>
}
function Intro() {
  return <section className="landing-section landing-intro" aria-labelledby="intro-heading"><div className="landing-container">
    <div className="landing-intro-copy"><Reveal><h2 id="intro-heading">A cleaner home means more <em>time for everything else.</em></h2></Reveal>
      <Reveal delay={90}><div><p>Mirembe exists to give homeowners, families, landlords, and busy households reliable cleaning support — without adding one more thing to manage.</p><p>We take care of the cleaning. You get back the evenings, the weekends, and the quiet feeling of walking into a home that’s ready for you.</p><div className="landing-chips"><span>Homeowners</span><span>Families</span><span>Landlords</span><span>Busy households</span></div></div></Reveal>
    </div>
    <div className="landing-intro-images"><Reveal><img src={photo('Sunlit Lavender Kitchen Morning')} alt="Couple relaxing together in their sunlit kitchen" width="1536" height="1024" loading="lazy" /></Reveal><Reveal delay={100}><img src={photo('Serene Morning on the Sofa')} alt="Calm living room with a woman enjoying a quiet moment" width="1536" height="1024" loading="lazy" /></Reveal></div>
  </div></section>
}
function Services({ requestInfo }: { requestInfo: () => void }) {
  return <section className="landing-section landing-services" id="services" aria-labelledby="services-heading"><div className="landing-container">
    <Reveal><div className="landing-services-intro"><SectionHeading id="services-heading" eyebrow="Residential cleaning services" title="Cleaning designed around your home." description="From regular upkeep to a full reset before a move, every Mirembe service is built to leave your home comfortable, fresh, and ready to enjoy." /><button className="landing-text-link" type="button" onClick={requestInfo}>Not sure what you need? Request a cleaning <Icon name="arrow-right" /></button></div></Reveal>
    <div className="landing-service-grid">{services.map(([title, description, image], index) => <Reveal key={title} delay={index * 70}><article className="landing-service-card"><img src={photo(image)} alt="" width="1448" height="1086" loading="lazy" /><div className="landing-service-overlay" /><button className="landing-service-card-hit" type="button" onClick={requestInfo} aria-label={`Request ${title} — booking link coming soon`} /><div className="landing-service-content"><span className="landing-service-icon"><ServiceIcon index={index} /></span><h3>{title}</h3><p>{description}</p><span className="landing-service-action">Request this service <Icon name="service-arrow" /></span></div></article></Reveal>)}<Reveal delay={350}><div className="landing-service-help"><p>Not sure which clean is right?</p><h3>Tell us about your home and we’ll help you choose.</h3><RequestButton onClick={requestInfo} inverse /></div></Reveal></div>
  </div></section>
}
function HowItWorks({ open, joined, requestInfo }: { open: () => void; joined: boolean; requestInfo: () => void }) {
  const stepsRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const steps = stepsRef.current
    if (!steps) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      steps.style.setProperty('--steps-progress', '1')
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      const nodes = steps.querySelectorAll<HTMLElement>('.landing-step-node')
      const first = nodes[0]?.getBoundingClientRect()
      const last = nodes[nodes.length - 1]?.getBoundingClientRect()
      if (!first || !last) return
      const railTop = first.top + first.height / 2
      const railHeight = last.top + last.height / 2 - railTop
      steps.style.setProperty('--rail-top', `${railTop - steps.getBoundingClientRect().top}px`)
      steps.style.setProperty('--rail-height', `${railHeight}px`)
      const progress = Math.max(0, Math.min(1, (window.innerHeight * 0.6 - railTop) / railHeight))
      steps.style.setProperty('--steps-progress', String(progress))
      const activeIndex = Math.min(2, Math.floor(progress * 2))
      for (const [index, step] of Array.from(steps.children).entries()) {
        step.setAttribute('data-state', index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'inactive')
      }
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame) window.cancelAnimationFrame(frame) }
  }, [])
  const steps = [
    ['Tell us about your home', 'Choose the service you need and share a few basics about your space.'],
    ['We coordinate your clean', 'Mirembe confirms availability in your area and coordinates the details with you.'],
    ['Come home to more peace', 'Your space is cleaned with care, so you can spend your time on everything else.'],
  ]
  return <section className="landing-section landing-how" id="how-it-works" aria-labelledby="how-heading"><div className="landing-container landing-how-grid"><Reveal><SectionHeading id="how-heading" center eyebrow="How it works" title="Booking Mirembe is simple." description="Three easy steps between you and a calmer home. We handle the coordination so you don’t have to." /></Reveal><ol className="landing-steps" ref={stepsRef}>{steps.map(([title, body], index) => <li key={title} className={index === 1 ? 'is-left' : 'is-right'} data-state="complete"><span className="landing-step-node" aria-hidden="true" /><div className="landing-step-content"><span className="landing-step-number">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p></div></li>)}</ol><div className="landing-cta-group"><RequestButton onClick={requestInfo} inverse /><WaitlistButton open={open} joined={joined} variant="inverse" /></div></div></section>
}
function WhyMirembe() {
  return <section className="landing-section landing-why" id="why-mirembe" aria-labelledby="why-heading"><div className="landing-container landing-why-grid"><Reveal><div className="landing-why-image"><img src={photo('Cozy Family Reading in Sunlight')} alt="Family relaxing together in a bright home" width="1412" height="1114" loading="lazy" /><span><Icon name="leaf" />Peace begins at home</span></div></Reveal><div><Reveal><SectionHeading id="why-heading" eyebrow="Why Mirembe" title="Cleaning built around care." description="The kind of cleaning help you feel comfortable inviting into your home — thoughtful, dependable, and easy to work with." /></Reveal><div className="landing-benefits">{benefits.map(([title, body], index) => <Reveal key={title} delay={index * 60}><div className="landing-benefit"><span className="landing-benefit-icon"><Icon name={['benefit-heart', 'benefit-check', 'benefit-message', 'benefit-calendar'][index]} /></span><div><h3>{title}</h3><p>{body}</p></div></div></Reveal>)}</div><Reveal><div className="landing-peace-line"><span className="landing-peace-icon"><Icon name="benefit-peace" /></span><p><em>Peace</em> of mind.<span>The real benefit behind every clean — one less thing competing for your time.</span></p></div></Reveal></div></div></section>
}
function Areas({ open, joined }: { open: () => void; joined: boolean }) {
  function focusZip() {
    window.requestAnimationFrame(() => document.getElementById('availability-zip')?.focus({ preventScroll: true }))
  }
  const areas = [
    ['MASSACHUSETTS', 'Greater Boston and surrounding communities', 'Residential cleaning for homes, families, and rental properties in Boston and nearby Massachusetts communities.', 'Greater Boston', 'Pastel Boston Map with Purple Marker', 'Stylized map centered on Boston, Massachusetts'],
    ['CONNECTICUT', 'Newington and surrounding communities', 'Residential cleaning for homes, families, and rental properties in Newington and nearby Central Connecticut communities.', 'Newington', 'Pastel Hartford Area Map with Newington Highlighted', 'Stylized map centered on Newington, Connecticut'],
  ] as const
  return <section className="landing-section landing-areas" id="areas" aria-labelledby="areas-heading"><div className="landing-container"><Reveal><SectionHeading id="areas-heading" center eyebrow="Areas we serve" title="Cleaning services near home." description="Mirembe Cleaning Company serves homes in Greater Boston, Massachusetts and the Newington, Connecticut area — with more surrounding communities as we grow." /></Reveal><div className="landing-area-grid">{areas.map(([state, title, body, badge, map, alt], index) => <Reveal key={state} delay={index * 100}><article className="landing-area-card"><a className="landing-area-card-link" href="#availability" onClick={focusZip}><div className="landing-map"><img src={photo(map)} alt={alt} width="1536" height="1024" loading="lazy" /></div><div className="landing-area-content"><p className="landing-overline"><Icon name="region-pin" />{state}</p><h3>{title}</h3><p>{body}</p><div className="landing-area-badges"><span className="landing-area-badge"><Icon name="badge-pin" />{badge}</span><span className="landing-area-badge is-coming"><Icon name="badge-plus" />More communities soon</span></div><span className="landing-text-link">Check availability for your ZIP code <Icon name="arrow-right" /></span></div></a></article></Reveal>)}</div><Reveal><ZipAvailability openWaitlist={open} joined={joined} /></Reveal></div></section>
}
function Founders() {
  return <section className="landing-section landing-founders" id="about" aria-labelledby="founders-heading"><div className="landing-container landing-founders-grid"><Reveal><div><p className="landing-eyebrow">A note from our founders</p><h2 id="founders-heading">We believe peace begins at <em>home.</em></h2><p>As homeowners, parents, and landlords, we know firsthand how difficult it can be to find cleaning help that’s reliable, thoughtful, and fairly priced.</p><p>So we created Mirembe — the cleaning company we always wished we could call. A family-owned business built on care, trust, and the belief that every home deserves a little more peace.</p><blockquote>“Mirembe” means peace and tranquility.</blockquote><div className="landing-signature"><span>With care,</span><strong>Felix &amp; Bria</strong><small>Founders, Mirembe Cleaning Company</small></div></div></Reveal><Reveal delay={100}><div className="landing-founder-photo"><span>Family-owned in MA &amp; CT</span></div></Reveal></div></section>
}
function Faq() {
  const [expanded, setExpanded] = useState<number | null>(0)
  return <section className="landing-section landing-faq" id="faq" aria-labelledby="faq-heading"><div className="landing-container landing-faq-grid"><Reveal><SectionHeading id="faq-heading" title="Frequently asked questions." description="Straight answers about our services, where we clean, and how booking works." /></Reveal><div className="landing-faq-list">{faqs.map(([question, answer], index) => <div className="landing-faq-item" key={question}><h3><button id={`faq-question-${index}`} type="button" aria-expanded={expanded === index} aria-controls={`faq-answer-${index}`} onClick={() => setExpanded(expanded === index ? null : index)}>{question}<span aria-hidden="true"><Icon name={expanded === index ? 'faq-minus' : 'faq-plus'} /></span></button></h3><div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} hidden={expanded !== index}><p>{answer}</p></div></div>)}</div></div></section>
}
function Footer({ open, joined }: { open: () => void; joined: boolean }) {
  return <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-grid"><div><a className="landing-brand-link" href="#top" aria-label="Mirembe Cleaning Company, back to top"><BrandLogo /></a><p>Thoughtful residential cleaning serving Greater Boston and communities around Newington, Connecticut.</p><div className="landing-social"><a href={business.socialProfiles.instagram} aria-label="Instagram"><Icon name="instagram" /></a><a href={business.socialProfiles.facebook} aria-label="Facebook"><Icon name="facebook" /></a><a href={`mailto:${business.publicEmail}`} aria-label="Email Mirembe"><Icon name="social-mail" /></a></div><a href={`mailto:${business.publicEmail}`}>{business.publicEmail}</a></div><div><h2>Services</h2>{services.map(([title]) => <a href="#services" key={title}>{title}</a>)}</div><div><h2>Areas We Serve</h2><a href="#areas">Greater Boston, MA</a><a href="#areas">Newington, CT</a></div><div><h2>Company</h2><a href="#about">About Mirembe</a><WaitlistButton open={open} joined={joined} variant="secondary" /><a href={`mailto:${business.publicEmail}`}>Contact</a></div></div><div className="landing-footer-bottom"><p>© 2026 Mirembe Cleaning Company. Family-owned. “Mirembe” means peace and tranquility.</p>{marketing.privacyPolicyUrl && <a href={marketing.privacyPolicyUrl}>Privacy Policy</a>}</div></div></footer>
}
export function LandingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [joined, setJoined] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' | 'verification' | 'info' } | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const timer = useRef<number | null>(null)
  const showToast = useCallback((message: string, kind: 'success' | 'error' | 'verification' | 'info') => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setToast({ message, kind })
    timer.current = window.setTimeout(() => setToast(null), kind === 'success' ? 5000 : 8000)
  }, [])
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  function open() { if (!joined) { trigger.current = document.activeElement as HTMLElement; trackEvent('waitlist_cta_click'); setWaitlistOpen(true) } }
  function dismiss() { setWaitlistOpen(false); window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })) }
  function created() { setJoined(true); showToast('You’re on the waitlist.', 'success') }
  function requestInfo() { showToast('The booking link is coming soon. Join the waitlist for updates.', 'info') }
  return <div className="landing-page"><Header open={open} joined={joined} requestInfo={requestInfo} /><main><Hero open={open} joined={joined} requestInfo={requestInfo} /><Intro /><Services requestInfo={requestInfo} /><HowItWorks open={open} joined={joined} requestInfo={requestInfo} /><WhyMirembe /><Areas open={open} joined={joined} /><Founders /><section className="landing-cta-wrap" aria-labelledby="cta-banner-heading"><div className="landing-container"><Reveal><div className="landing-cta-banner"><div><p className="landing-eyebrow">A little more peace for the holidays</p><h2 id="cta-banner-heading">Limited cleaning availability is opening in Massachusetts and Connecticut.</h2><p>Request a cleaning for your home this season, or join the waitlist to hear first when more availability opens.</p></div><div className="landing-cta-group"><RequestButton onClick={requestInfo} /><WaitlistButton open={open} joined={joined} variant="secondary" /></div></div></Reveal></div></section><Faq /><section className="landing-final-cta" aria-labelledby="final-cta-heading"><div className="landing-container"><Reveal><h2 id="final-cta-heading">Come home to <em>more peace.</em></h2><p>Let us take cleaning off your list.</p><div className="landing-cta-group"><RequestButton onClick={requestInfo} /><WaitlistButton open={open} joined={joined} variant="secondary" /></div><CleaningTeamLink /></Reveal></div></section></main><Footer open={open} joined={joined} /><AnalyticsConsent /><WaitlistModal open={waitlistOpen} onDismiss={dismiss} onCreated={created} onFeedback={showToast} />{toast && <div className={`landing-toast is-${toast.kind}`} role={toast.kind === 'success' ? 'status' : 'alert'}><span aria-hidden="true">{toast.kind === 'success' ? '✓' : '!'}</span><p>{toast.message}</p><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification">×</button></div>}</div>
}
