import { useCallback, useEffect, useRef, useState } from 'react'
import { BrandLogo } from '../BrandLogo'
import { CleaningTeamLink } from '../CleaningTeamLink'
import { AnalyticsConsent } from '../AnalyticsConsent'
import { business } from '../../config/business'
import { marketing } from '../../config/marketing'
import { holidayCampaign, hasSeenHolidayModal, isHolidayCampaignActive, launch, markHolidayModalSeen } from '../../config/campaigns'
import { trackEvent } from '../../lib/analytics'
import { Reveal } from './Reveal'
import { WaitlistModal } from './WaitlistModal'
import { HolidayFloatingCTA, HolidayPromoModal } from './HolidayCampaign'
import { ServiceDetailDialog } from './ServiceDetailDialog'
import { areas, benefits, faqs, services, type Service } from './content'

const photo = (name: string) => '/landing/v2/' + name + '.webp'
const icon = (name: string) => '/landing/icons/' + name + '.svg'
function Icon({ name }: { name: string }) { return <img src={icon(name)} alt="" aria-hidden="true" /> }

function WaitlistButton({ open, joined, variant = 'primary', showArrow = false }: { open: () => void; joined: boolean; variant?: 'primary' | 'secondary' | 'inverse'; showArrow?: boolean }) {
  return <button className={'landing-button is-' + (joined ? 'confirmed' : variant)} type="button" disabled={joined} onClick={open} aria-haspopup={joined ? undefined : 'dialog'}>
    {joined ? <>✓ You’re on the waitlist</> : <>Join the Waitlist{showArrow && <Icon name="button-arrow-light" />}</>}
  </button>
}
function RequestButton({ onClick, onDark = false, primary = false }: { onClick: () => void; onDark?: boolean; primary?: boolean }) {
  return <button className={'landing-button is-' + (primary ? 'primary' : 'secondary') + (onDark ? ' is-on-dark' : '')} type="button" onClick={onClick}>Request a Cleaning{primary && <Icon name="button-arrow-light" />}</button>
}
function SectionHeading({ eyebrow, title, description, id, center = false }: { eyebrow?: string; title: string; description?: string; id: string; center?: boolean }) {
  return <div className={'landing-section-heading' + (center ? ' is-centered' : '')}>{eyebrow && <p className="landing-eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>
}

function Header({ open, joined, requestInfo, menuOpen, setMenuOpen }: { open: () => void; joined: boolean; requestInfo: () => void; menuOpen: boolean; setMenuOpen: (value: boolean) => void }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return <header className={'landing-header' + (scrolled ? ' is-scrolled' : '')}><div className="landing-header-inner landing-container">
    <a href="#top" aria-label="Mirembe Cleaning Company, back to top" className="landing-brand-link"><BrandLogo /></a>
    <button className="landing-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="landing-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : '☰'}</button>
    <nav id="landing-nav" className={'landing-nav' + (menuOpen ? ' is-open' : '')} aria-label="Main navigation">
      {[['Services', '#services'], ['Why Mirembe', '#why-mirembe'], ['Areas We Serve', '#areas'], ['FAQ', '#faq']].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
      <WaitlistButton open={() => { setMenuOpen(false); open() }} joined={joined} variant="secondary" />
      <RequestButton primary onClick={() => { setMenuOpen(false); requestInfo() }} />
    </nav>
  </div></header>
}

function Hero({ open, joined, requestInfo, campaignActive }: { open: () => void; joined: boolean; requestInfo: () => void; campaignActive: boolean }) {
  return <section className="landing-hero" id="top" aria-labelledby="hero-heading"><div className="landing-container landing-hero-grid">
    <div className="landing-hero-copy">
      <Reveal initial><p className="landing-availability"><Icon name="leaf" /><span className="landing-availability-desktop">Mirembe Cleaning Company · Greater Hartford &amp; Greater Boston</span><span className="landing-availability-mobile">Mirembe Cleaning Company</span></p></Reveal>
      <Reveal initial delay={80}><h1 id="hero-heading">A Cleaner Home, <span>More Peace.</span></h1></Reveal>
      <Reveal initial delay={160}><p className="landing-hero-lede">Trusted home and rental cleaning across Greater Hartford, CT, and Greater Boston, MA. Thoughtful, reliable cleaning designed to give you one less thing to worry about.</p></Reveal>
      <Reveal initial delay={240}><div className="landing-hero-actions"><div className="landing-cta-group"><WaitlistButton open={open} joined={joined} showArrow /><RequestButton onClick={requestInfo} /></div><p>{launch.headline}{campaignActive && <> {launch.holidayMessage}</>}</p></div></Reveal>
      <Reveal initial delay={320} className="landing-quick-facts-desktop"><ul className="landing-quick-facts"><li><Icon name="home" />Home &amp; rental cleaning</li><li><Icon name="map-pin" />Greater Boston, MA</li><li><Icon name="map-pin" />Greater Hartford, CT</li></ul></Reveal>
    </div>
    <Reveal initial delay={400} className="landing-hero-visual">
      <picture><source media="(max-width: 767px)" srcSet={photo('hero_mobile')} /><img className="landing-hero-photo" src={photo('hero')} alt="Bright, freshly cleaned living room" width="1672" height="941" fetchPriority="high" /></picture>
      <img className="landing-hero-inset" src={photo('inset')} alt="Family enjoying time together at home" width="1122" height="1402" loading="lazy" />
      <div className="landing-meaning-card"><strong>Mirembe</strong><span>peace · tranquility</span></div>
    </Reveal>
    <ul className="landing-quick-facts landing-quick-facts-mobile"><li><Icon name="home" />Home &amp; rental cleaning</li><li><Icon name="map-pin" />Greater Hartford, CT</li><li><Icon name="map-pin" />Greater Boston, MA</li></ul>
  </div></section>
}

function BrandStory() {
  return <section className="landing-section landing-story" id="story" aria-label="The meaning behind Mirembe and our story"><div className="landing-container landing-story-rows">
    <div className="landing-story-row"><Reveal><div className="landing-story-copy"><p className="landing-eyebrow">The meaning behind our name</p><h2>Mirembe Means <em>Peace.</em></h2><p>In Ugandan Bantu languages, Mirembe means “peace” or “tranquility” — a hope for harmony, for one person and for the whole community.</p><p>That’s what we want you to feel when you walk through your door: a calm, clean space and one less thing to worry about.</p></div></Reveal><Reveal delay={90}><img src={photo('meaning')} alt="A woman relaxing on a sofa in a peaceful home" width="1536" height="1024" loading="lazy" /></Reveal></div>
    <div className="landing-story-row is-reversed"><Reveal><div className="landing-story-copy"><p className="landing-eyebrow">Our story</p><h2>Built With Care.<br /><em>Rooted in Family.</em></h2><p>Mirembe Cleaning Company was founded by a husband and wife who are homeowners, multifamily real estate investors, and landlords. Between caring for our own home, our family, and our rental properties, we saw how difficult it could be to find cleaning help that was reliable, efficient, and fairly priced.</p><p>So we built the kind of cleaning company we wanted for ourselves.</p><p>As a woman- and minority-owned family business serving Connecticut and Massachusetts, we treat every home with the same care we’d give our own. Whether it’s a rental between tenants, a busy family’s home, a parent who needs a little extra help, or someone experiencing health or mobility challenges, our goal is to make life a little easier.</p><p>When you choose Mirembe, you’re not just hiring a cleaning company. You’re welcoming a family that cares.</p></div></Reveal><Reveal delay={90}><img src={photo('story')} alt="A couple together in a bright kitchen" width="1536" height="1024" loading="lazy" /></Reveal></div>
  </div></section>
}

function Services({ openService, requestInfo }: { openService: (service: Service) => void; requestInfo: () => void }) {
  return <section className="landing-section landing-services" id="services" aria-labelledby="services-heading"><div className="landing-container">
    <Reveal><div className="landing-services-intro"><SectionHeading id="services-heading" eyebrow="Our services" title="Cleaning designed around your home." description="Every clean follows our room-by-room checklist, so you know exactly what to expect." /><button className="landing-text-link" type="button" onClick={requestInfo}>Not sure what you need? Request a cleaning <Icon name="arrow-right" /></button></div></Reveal>
    <div className="landing-service-grid">{services.map((service, index) => <Reveal key={service.slug} delay={index * 70}><article className="landing-service-card"><img src={photo(service.image)} alt="" width="1536" height="1024" loading="lazy" /><div className="landing-service-overlay" /><button className="landing-service-card-hit" type="button" onClick={() => openService(service)} aria-haspopup="dialog" aria-label={'What’s included in ' + service.title} /><div className="landing-service-content"><span className="landing-service-icon"><Icon name={service.icon} /></span><h3>{service.title}</h3><p>{service.summary}</p><span className="landing-service-action">What’s Included <Icon name="service-arrow" /></span></div></article></Reveal>)}</div>
    <Reveal><div className="landing-addons-strip"><span className="landing-addons-title"><span aria-hidden="true">＋</span>Available add-ons</span><span className="landing-area-badge"><Icon name="badge-pin" />Inside cabinets</span><span className="landing-area-badge"><Icon name="badge-pin" />Dishes</span><p>Choose add-ons when you book. Availability varies by service.</p></div></Reveal>
  </div></section>
}

function HowItWorks({ open, joined, requestInfo }: { open: () => void; joined: boolean; requestInfo: () => void }) {
  const steps = [
    ['Choose Your Clean', 'Select your service, home size, and any extras you need.'],
    ['See Your Price & Book', 'Get transparent pricing and choose a date that works for you.'],
    ['Come Home to More Peace', 'Our trained team arrives with the supplies, follows the Mirembe checklist, and takes care of the rest.'],
  ]
  return <section className="landing-section landing-how" id="how-it-works" aria-labelledby="how-heading"><div className="landing-container landing-how-grid"><Reveal><SectionHeading id="how-heading" center eyebrow="How it works" title="Booking Mirembe is simple." description="Three simple steps — from choosing your clean to coming home to more peace." /></Reveal><ol className="landing-steps">{steps.map(([title, body], index) => <li key={title} className={index === 1 ? 'is-left' : 'is-right'} data-state="complete"><span className="landing-step-node" aria-hidden="true" /><div className="landing-step-content"><span className="landing-step-number">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p></div></li>)}</ol><div className="landing-cta-group"><WaitlistButton open={open} joined={joined} variant="inverse" /><RequestButton onClick={requestInfo} onDark /></div></div></section>
}

function WhyMirembe() {
  return <section className="landing-section landing-why" id="why-mirembe" aria-labelledby="why-heading"><div className="landing-container landing-why-grid"><Reveal><div className="landing-why-image"><img src={photo('why')} alt="Family relaxing together in a bright home" width="1536" height="1024" loading="lazy" /><span><Icon name="leaf" />Peace begins at home</span></div></Reveal><div><Reveal><SectionHeading id="why-heading" eyebrow="Why families choose us" title="Why Mirembe?" description="Six reasons homeowners, families, and landlords trust us with the places that matter most." /></Reveal><div className="landing-benefits">{benefits.map((benefit, index) => <Reveal key={benefit.title} delay={index * 60}><div className="landing-benefit"><span className="landing-benefit-icon"><img src={'/landing/v2/' + benefit.icon + '.svg'} alt="" /></span><div><h3>{benefit.title}</h3><p>{benefit.body}</p></div></div></Reveal>)}</div></div></div></section>
}

function Areas({ open, joined }: { open: () => void; joined: boolean }) {
  return <section className="landing-section landing-areas" id="areas" aria-labelledby="areas-heading"><div className="landing-container"><Reveal><SectionHeading id="areas-heading" center eyebrow="Where we serve" title="Cleaning services near home." description="Mirembe serves homes and rental properties across Greater Hartford, Connecticut, and Greater Boston, Massachusetts." /></Reveal><div className="landing-area-grid">{areas.map((area, index) => <Reveal key={area.state} delay={index * 100}><article className="landing-area-card"><div className="landing-map"><img src={photo(area.map)} alt={area.alt} width="1536" height="1024" loading="lazy" /></div><div className="landing-area-content"><p className="landing-overline"><Icon name="region-pin" />{area.state}</p><h3>{area.title}</h3><p>{area.body}</p><div className="landing-area-badges">{area.towns.map(town => <span className="landing-area-badge" key={town}><Icon name="badge-pin" />{town}</span>)}<span className="landing-area-badge is-coming">Nearby Towns</span></div><button className="landing-text-link" type="button" onClick={open}>Check availability for your ZIP code <Icon name="arrow-right" /></button></div></article></Reveal>)}</div><Reveal><div className="landing-area-prompt"><div><h3>Don’t see your town?</h3><p>Join the waitlist and let us know. We’re growing, and your request helps us decide where Mirembe goes next.</p></div><WaitlistButton open={open} joined={joined} variant="secondary" /></div></Reveal></div></section>
}

function Founders() {
  return <section className="landing-section landing-founders" id="about" aria-labelledby="founders-heading"><div className="landing-container landing-founders-grid"><Reveal><div><p className="landing-eyebrow">A note from our founders</p><h2 id="founders-heading">Built from our home to <em>yours.</em></h2><p>As homeowners, landlords, and multifamily real estate investors, we’ve experienced firsthand how difficult it can be to find cleaning help that’s reliable, efficient, and fairly priced.</p><p>Between caring for our own home, our family, and our rental properties, we knew there had to be a better way.</p><p>So we decided to build the kind of cleaning company we’d want caring for our own home and properties. As a woman- and minority-owned family business serving Connecticut and Massachusetts, we believe every home deserves thoughtful, dependable care.</p><p>Whether we’re helping a busy family, preparing a rental for its next tenant, or supporting someone who needs an extra hand, our goal remains the same: to make life feel a little easier.</p><blockquote>When you choose Mirembe, you’re not just hiring a cleaning company. You’re welcoming a family that cares.</blockquote><div className="landing-signature"><span>With care,</span><strong>Felix &amp; Bria</strong><small>Founders, Mirembe Cleaning Company</small></div></div></Reveal><Reveal delay={100}><div className="landing-founder-photo"><span>Woman- &amp; minority-owned · CT &amp; MA</span></div></Reveal></div></section>
}

function Faq({ campaignActive }: { campaignActive: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  return <section className="landing-section landing-faq" id="faq" aria-labelledby="faq-heading"><div className="landing-container landing-faq-grid"><Reveal><SectionHeading id="faq-heading" title="Frequently asked questions." description="Everything you need to know before your first clean." /></Reveal><div className="landing-faq-list">{faqs.map(([question, answer], index) => <div className="landing-faq-item" key={question}><h3><button id={'faq-question-' + index} type="button" aria-expanded={expanded === index} aria-controls={'faq-answer-' + index} onClick={() => setExpanded(expanded === index ? null : index)}>{question}<span aria-hidden="true"><Icon name={expanded === index ? 'faq-minus' : 'faq-plus'} /></span></button></h3><div id={'faq-answer-' + index} role="region" aria-labelledby={'faq-question-' + index} hidden={expanded !== index}><p>{index === 0 && !campaignActive ? launch.regularBookingsMessage : answer}</p></div></div>)}</div></div></section>
}

function Footer() {
  return <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-grid"><div><a className="landing-brand-link" href="#top" aria-label="Mirembe Cleaning Company, back to top"><BrandLogo /></a><p>Thoughtful home and rental cleaning serving Greater Hartford, CT, and Greater Boston, MA.</p><div className="landing-social"><a href={business.socialProfiles.instagram} aria-label="Instagram"><Icon name="instagram" /></a><a href={business.socialProfiles.facebook} aria-label="Facebook"><Icon name="facebook" /></a><a href={'mailto:' + business.publicEmail} aria-label="Email Mirembe"><Icon name="social-mail" /></a></div><a href={'mailto:' + business.publicEmail}>{business.publicEmail}</a></div><div><h2>Services</h2><a href="#services">Standard Clean</a><a href="#services">Deep Clean</a><a href="#services">Rental Turnovers</a><a href="#services">Move-In / Move-Out</a></div><div><h2>Areas We Serve</h2><a href="#areas">Greater Hartford, CT</a><a href="#areas">Greater Boston, MA</a><a href="#areas">Don’t see your town?</a></div><div><h2>Company</h2><a href="#about">About Mirembe</a><a href="#faq">FAQ</a><CleaningTeamLink /><a href={'mailto:' + business.publicEmail}>Contact</a></div></div><div className="landing-footer-bottom"><p>© 2026 Mirembe Cleaning Company. Family-owned. “Mirembe” means peace and tranquility.</p>{marketing.privacyPolicyUrl && <a href={marketing.privacyPolicyUrl}>Privacy Policy</a>}</div></div></footer>
}

export function LandingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [joined, setJoined] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [anyDialogOpen, setAnyDialogOpen] = useState(false)
  const [campaignActive, setCampaignActive] = useState(() => isHolidayCampaignActive())
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' | 'verification' | 'info' } | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const timer = useRef<number | null>(null)
  const showToast = useCallback((message: string, kind: 'success' | 'error' | 'verification' | 'info') => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setToast({ message, kind })
    timer.current = window.setTimeout(() => setToast(null), kind === 'success' ? 5000 : 8000)
  }, [])
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  useEffect(() => {
    const interval = window.setInterval(() => setCampaignActive(isHolidayCampaignActive()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    const sync = () => setAnyDialogOpen(Boolean(document.querySelector('dialog[open]')))
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true })
    sync()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!campaignActive || hasSeenHolidayModal()) return
    const params = new URLSearchParams(window.location.search)
    if ([...params.entries()].some(([key, value]) => key.startsWith('utm_') && /holiday/i.test(value))) return
    let idleId: number | undefined
    const timeout = window.setTimeout(() => {
      const show = () => {
        if (hasSeenHolidayModal() || document.querySelector('dialog[open]') || document.querySelector('.landing-nav.is-open') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return
        markHolidayModalSeen()
        setHolidayOpen(true)
      }
      if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(show, { timeout: 1500 })
      else show()
    }, holidayCampaign.modalDelayMs)
    return () => { window.clearTimeout(timeout); if (idleId !== undefined) window.cancelIdleCallback(idleId) }
  }, [campaignActive])
  function open() { if (!joined) { trigger.current = document.activeElement as HTMLElement; setHolidayOpen(false); setSelectedService(null); trackEvent('waitlist_cta_click'); setWaitlistOpen(true) } }
  function dismiss() { setWaitlistOpen(false); window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })) }
  function created() { setJoined(true); showToast('You’re on the waitlist.', 'success') }
  function requestInfo() { showToast('The booking link is coming soon. Join the waitlist for updates.', 'info') }
  function bookHoliday() { markHolidayModalSeen(); setHolidayOpen(false) }
  function openService(service: Service) { setSelectedService(service) }
  const dialogOpen = waitlistOpen || Boolean(selectedService) || holidayOpen || anyDialogOpen
  return <div className="landing-page"><Header open={open} joined={joined} requestInfo={requestInfo} menuOpen={menuOpen} setMenuOpen={setMenuOpen} /><main><Hero open={open} joined={joined} requestInfo={requestInfo} campaignActive={campaignActive} /><BrandStory /><Services openService={openService} requestInfo={requestInfo} /><HowItWorks open={open} joined={joined} requestInfo={requestInfo} /><WhyMirembe /><Areas open={open} joined={joined} /><Founders /><Faq campaignActive={campaignActive} /><section className="landing-final-cta" aria-labelledby="final-cta-heading"><div className="landing-container"><Reveal><h2 id="final-cta-heading">Ready for a cleaner home<br /><em>and more peace?</em></h2><p>Join our waitlist for the January 2027 launch{campaignActive ? ', or explore our limited holiday cleaning availability.' : '.'}</p><div className="landing-cta-group"><WaitlistButton open={open} joined={joined} /><RequestButton onClick={requestInfo} /></div></Reveal></div></section></main><Footer /><AnalyticsConsent /><WaitlistModal open={waitlistOpen} onDismiss={dismiss} onCreated={created} onFeedback={showToast} /><ServiceDetailDialog service={selectedService} onDismiss={() => setSelectedService(null)} onRequest={() => { setSelectedService(null); requestInfo() }} />{campaignActive && <><HolidayFloatingCTA hidden={dialogOpen || menuOpen} onBooking={bookHoliday} /><HolidayPromoModal open={holidayOpen} onDismiss={() => setHolidayOpen(false)} onBooking={bookHoliday} /></>}{toast && <div className={'landing-toast is-' + toast.kind} role={toast.kind === 'success' ? 'status' : 'alert'}><span aria-hidden="true">{toast.kind === 'success' ? '✓' : '!'}</span><p>{toast.message}</p><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification">×</button></div>}</div>
}
