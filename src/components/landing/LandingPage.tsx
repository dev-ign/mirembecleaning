import { useLocalizedHref } from '../../i18n/useLocalizedHref'
import { LanguageSelector } from '../LanguageSelector'
import { t, Trans, useLocale, type MessageKey } from '../../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BrandLogo } from '../BrandLogo'
import { CleaningTeamLink, CleaningTeamProvider } from '../CleaningTeamLink'
import { AnalyticsConsent, TrackingPreferencesButton } from '../AnalyticsConsent'
import { business } from '../../config/business'
import { privacyConfig, termsConfig } from '../../config/legal'
import { holidayCampaign, isHolidayCampaignActive } from '../../config/campaigns'
import { bookingConfig } from '../../config/booking'
import { trackEvent, trackBookingCTA, trackServiceView } from '../../lib/optionalEvents'
import type { BookingLocation } from '../../lib/analytics/types'
import { Reveal } from './Reveal'
import { WaitlistModal } from './WaitlistModal'
import { HolidayFloatingCTA, HolidayPromoModal } from './HolidayCampaign'
import { ServiceDetailDialog } from './ServiceDetailDialog'
import { HowItWorksTimeline } from './HowItWorksTimeline'
import { navigationSections, useActiveNavigation } from './useActiveNavigation'
import { getAreas, getBenefits, getFaqs, getServices, type Service } from './content'

const photo = (name: string) => '/landing/v2/' + name + '.webp'
const icon = (name: string) => '/landing/icons/' + name + '.svg'
function Icon({ name }: { name: string }) { return <img src={icon(name)} alt="" aria-hidden="true" /> }

function WaitlistButton({ open, joined, variant = 'primary', showArrow = false }: { open: () => void; joined: boolean; variant?: 'primary' | 'secondary' | 'inverse'; showArrow?: boolean }) {
  useLocale()
  return <button className={'landing-button is-' + (joined ? 'confirmed' : variant)} type="button" disabled={joined} onClick={open} aria-haspopup={joined ? undefined : 'dialog'}>
    {joined ? <>{t('waitlist.joinedCheck')}</> : <>{t('waitlist.join')}{showArrow && <Icon name="button-arrow-light" />}</>}
  </button>
}
function RequestButton({ onDark = false, primary = false, subtle = false, onNavigate, location }: { onDark?: boolean; primary?: boolean; subtle?: boolean; onNavigate?: () => void; location: BookingLocation }) {
  const localHref = useLocalizedHref()
  useLocale()
  return <a className={subtle ? 'landing-booking-link' : 'landing-button is-' + (primary ? 'primary' : 'secondary') + (onDark ? ' is-on-dark' : '')} href={localHref(bookingConfig.path)} onClick={() => { trackBookingCTA(location); onNavigate?.() }}>{t('common.requestCleaning')}{primary && <Icon name="button-arrow-light" />}</a>
}
function SectionHeading({ eyebrow, title, description, id, center = false }: { eyebrow?: string; title: string; description?: string; id: string; center?: boolean }) {
  useLocale()
  return <div className={'landing-section-heading' + (center ? ' is-centered' : '')}>{eyebrow && <p className="landing-eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>
}

export function Header({ open, joined, menuOpen, setMenuOpen, homePath = '' }: { homePath?: string; open: () => void; joined: boolean; menuOpen: boolean; setMenuOpen: (value: boolean) => void }) {
  const localHref = useLocalizedHref()
  useLocale()
  const [scrolled, setScrolled] = useState(false)
  const activeSection = useActiveNavigation()
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return <header className={'landing-header' + (scrolled ? ' is-scrolled' : '')}><div className="landing-header-inner landing-container">
    <a href={localHref(homePath + '#top')} aria-label={t('navigation.homeLabel')} className="landing-brand-link"><BrandLogo /></a>
    <nav id="landing-nav" className={'landing-nav' + (menuOpen ? ' is-open' : '')} aria-label={t('navigation.main')}>
      {navigationSections.map(({ id, labelKey }) => <a key={id} href={localHref(homePath + '#' + id)} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setMenuOpen(false)}>{t(labelKey)}</a>)}
      <RequestButton location="header" subtle onNavigate={() => setMenuOpen(false)} />
      <div className="landing-mobile-action"><WaitlistButton open={() => { setMenuOpen(false); open() }} joined={joined} /></div>
    </nav>
    <div className="landing-header-actions"><LanguageSelector mobileMenuOpen={menuOpen} onOpen={() => setMenuOpen(false)} /><WaitlistButton open={open} joined={joined} /></div>
    <button className="landing-menu-toggle" type="button" aria-label={menuOpen ? t('navigation.closeMenu') : t('navigation.openMenu')} aria-expanded={menuOpen} aria-controls="landing-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : '☰'}</button>
  </div></header>
}

function Hero({ open, joined, campaignActive }: { open: () => void; joined: boolean; campaignActive: boolean }) {
  useLocale()
  return <section className="landing-hero" id="top" aria-labelledby="hero-heading"><div className="landing-container landing-hero-grid">
    <div className="landing-hero-copy">
      <Reveal initial><p className="landing-availability"><Icon name="leaf" /><span><strong>{t('campaign.launch')}</strong>{campaignActive && <> · <span className="landing-announcement-detail">{t('campaign.availability')}</span></>}</span></p></Reveal>
      <Reveal initial delay={80}><h1 id="hero-heading"><Trans i18nKey="home.hero.title" components={{ accent: <span /> }} /></h1></Reveal>
      <Reveal initial delay={160}><p className="landing-hero-lede">{t('home.hero.lede')}</p></Reveal>
      <Reveal initial delay={240}><div className="landing-hero-actions"><div className="landing-cta-group"><WaitlistButton open={open} joined={joined} showArrow /><RequestButton location="hero" /></div><p className="landing-hero-trust"><span aria-hidden="true">✓</span><span>{t('common.cleanerTrust')}</span></p></div></Reveal>
      <Reveal initial delay={320} className="landing-hero-pathways"><div className="landing-quick-facts-desktop"><ul className="landing-quick-facts"><li><Icon name="home" />{t('home.hero.homeRental')}</li><li><Icon name="map-pin" />{t('areas.bostonShort')}</li><li><Icon name="map-pin" />{t('areas.hartfordShort')}</li></ul></div><CleaningTeamLink variant="hero" /></Reveal>
    </div>
    <Reveal initial delay={400} className="landing-hero-visual">
      <picture><source media="(max-width: 767px)" srcSet={photo('hero_mobile')} /><img className="landing-hero-photo" src={photo('hero')} alt={t('home.hero.photoAlt')} width="1672" height="941" fetchPriority="high" /></picture>
      <img className="landing-hero-inset" src={photo('inset')} alt={t('home.hero.insetAlt')} width="1122" height="1402" loading="lazy" />
      <div className="landing-meaning-card"><strong>Mirembe</strong><span>{t('home.hero.meaning')}</span></div>
    </Reveal>
    <ul className="landing-quick-facts landing-quick-facts-mobile"><li><Icon name="home" />{t('home.hero.homeRental')}</li><li><Icon name="map-pin" />{t('areas.hartfordShort')}</li><li><Icon name="map-pin" />{t('areas.bostonShort')}</li></ul>
  </div></section>
}

function BrandStory() {
  useLocale()
  return <section className="landing-section landing-story" id="story" aria-label={t('home.story.region')}><div className="landing-container landing-story-rows">
    <div className="landing-story-row"><Reveal><div className="landing-story-copy"><p className="landing-eyebrow">{t('home.story.meaningEyebrow')}</p><h2><Trans i18nKey="home.story.meaningTitle" components={{ accent: <em /> }} /></h2><p>{t('home.story.meaning')}</p><p>{t('home.story.feeling')}</p></div></Reveal><Reveal delay={90}><img src={photo('meaning')} alt={t('home.story.meaningAlt')} width="1536" height="1024" loading="lazy" /></Reveal></div>
    <div className="landing-story-row is-reversed"><Reveal><div className="landing-story-copy"><p className="landing-eyebrow">{t('home.story.eyebrow')}</p><h2><Trans i18nKey="home.story.familyTitle" components={{ br: <br />, accent: <em /> }} /></h2><p>{t('home.story.origin')}</p><p>{t('home.story.solution')}</p><p>{t('home.story.care')}</p><p>{t('home.story.welcome')}</p></div></Reveal><Reveal delay={90}><img src={photo('story')} alt={t('home.story.familyAlt')} width="1536" height="1024" loading="lazy" /></Reveal></div>
  </div></section>
}

function Services({ openService }: { openService: (service: Service) => void }) {
  const localHref = useLocalizedHref()
  useLocale()
  return <section className="landing-section landing-services" id="services" aria-labelledby="services-heading"><div className="landing-container">
    <Reveal><div className="landing-services-intro"><SectionHeading id="services-heading" eyebrow={t('services.eyebrow')} title={t('services.title')} description={t('services.description')} /></div></Reveal>
    <div className="landing-service-grid">{getServices().map((service, index) => <Reveal key={service.slug} delay={index * 70}><article className="landing-service-card"><img src={photo(service.image)} alt="" width="1536" height="1024" loading="lazy" /><div className="landing-service-overlay" /><button className="landing-service-card-hit" type="button" onClick={() => openService(service)} aria-haspopup="dialog" aria-label={t('services.includedLabel', { service: service.title })} /><div className="landing-service-content"><span className="landing-service-icon"><Icon name={service.icon} /></span><h3>{service.title}</h3><p>{service.summary}</p><span className="landing-service-action">{t('services.includedAction')}<Icon name="service-arrow" /></span></div></article></Reveal>)}</div>
    <Reveal className="landing-services-request"><a className="landing-text-link" href={localHref(bookingConfig.path)} onClick={() => trackBookingCTA('services')}>{t('services.help')}<Icon name="arrow-right" /></a></Reveal>
    <Reveal><div className="landing-addons-strip"><span className="landing-addons-title"><span aria-hidden="true">＋</span>{t('services.addons')}</span><span className="landing-area-badge"><Icon name="badge-pin" />{t('services.cabinets')}</span><span className="landing-area-badge"><Icon name="badge-pin" />{t('services.dishes')}</span><p>{t('services.addonNote')}</p></div></Reveal>
  </div></section>
}

function HowItWorks({ open, joined }: { open: () => void; joined: boolean }) {
  useLocale()
  return <section className="landing-section landing-how" id="how-it-works" aria-labelledby="how-heading"><div className="landing-container landing-how-grid"><Reveal><SectionHeading id="how-heading" center eyebrow={t('how.eyebrow')} title={t('how.title')} description={t('how.description')} /></Reveal><HowItWorksTimeline steps={[[t('how.choose.title'), t('how.choose.body')], [t('how.book.title'), t('how.book.body')], [t('how.peace.title'), t('how.peace.body')]]} /><div className="landing-cta-group"><WaitlistButton open={open} joined={joined} variant="inverse" /><RequestButton location="how_it_works" onDark /></div></div></section>
}

function WhyMirembe() {
  useLocale()
  return <section className="landing-section landing-why" id="why-mirembe" aria-labelledby="why-heading"><div className="landing-container landing-why-grid"><Reveal><div className="landing-why-image"><img src={photo('why')} alt={t('benefits.photoAlt')} width="1536" height="1024" loading="lazy" /><span><Icon name="leaf" />{t('benefits.caption')}</span></div></Reveal><div><Reveal><SectionHeading id="why-heading" eyebrow={t('benefits.eyebrow')} title={t('benefits.title')} description={t('benefits.description')} /></Reveal><div className="landing-benefits">{getBenefits().map((benefit, index) => <Reveal key={benefit.title} delay={index * 60}><div className="landing-benefit"><span className="landing-benefit-icon"><img src={'/landing/v2/' + benefit.icon + '.svg'} alt="" /></span><div><h3>{benefit.title}</h3><p>{benefit.body}</p></div></div></Reveal>)}</div></div></div></section>
}

function Areas({ open, joined }: { open: () => void; joined: boolean }) {
  useLocale()
  return <section className="landing-section landing-areas" id="areas" aria-labelledby="areas-heading"><div className="landing-container"><Reveal><SectionHeading id="areas-heading" center eyebrow={t('areas.eyebrow')} title={t('areas.title')} description={t('areas.description')} /></Reveal><div className="landing-area-grid">{getAreas().map((area, index) => <Reveal key={area.state} delay={index * 100}><article className="landing-area-card"><div className="landing-map"><img src={photo(area.map)} alt={area.alt} width="1536" height="1024" loading="lazy" /></div><div className="landing-area-content"><p className="landing-overline"><Icon name="region-pin" />{area.state}</p><h3>{area.title}</h3><p>{area.body}</p><div className="landing-area-badges">{area.towns.map(town => <span className="landing-area-badge" key={town}><Icon name="badge-pin" />{town}</span>)}<span className="landing-area-badge is-coming">{t('areas.nearby')}</span></div></div></article></Reveal>)}</div><Reveal><div className="landing-area-prompt"><div><h3>{t('areas.missingTown')}</h3><p>{t('areas.waitlist')}</p></div><WaitlistButton open={open} joined={joined} variant="secondary" /></div></Reveal></div></section>
}

function Founders() {
  useLocale()
  return <section className="landing-section landing-founders" id="about" aria-labelledby="founders-heading"><div className="landing-container landing-founders-grid"><Reveal><div><p className="landing-eyebrow">{t('home.founders.eyebrow')}</p><h2 id="founders-heading"><Trans i18nKey="home.founders.title" components={{ accent: <em /> }} /></h2><p>{t('home.founders.experience')}</p><p>{t('home.founders.need')}</p><p>{t('home.founders.mission')}</p><p>{t('home.founders.goal')}</p><blockquote>{t('home.story.welcome')}</blockquote><div className="landing-signature"><span>{t('home.founders.signoff')}</span><strong>Felix &amp; Bria</strong><small>{t('home.founders.role')}</small></div></div></Reveal><Reveal delay={100}><div className="landing-founder-photo"><img src="/Images/pictures%20of%20owners.jpeg" alt={t('home.founders.photoAlt')} width="1681" height="1868" loading="lazy" /></div></Reveal></div></section>
}

function Faq({ campaignActive }: { campaignActive: boolean }) {
  useLocale()
  const [expanded, setExpanded] = useState<number | null>(null)
  return <section className="landing-section landing-faq" id="faq" aria-labelledby="faq-heading"><div className="landing-container landing-faq-grid"><Reveal><SectionHeading id="faq-heading" eyebrow={t('faq.eyebrow')} title={t('faq.title')} description={t('faq.description')} /></Reveal><div className="landing-faq-list">{getFaqs().map(([question, answer], index) => <div className="landing-faq-item" key={question}><h3><button id={'faq-question-' + index} type="button" aria-expanded={expanded === index} aria-controls={'faq-answer-' + index} onClick={() => setExpanded(expanded === index ? null : index)}>{question}<span aria-hidden="true"><Icon name={expanded === index ? 'faq-minus' : 'faq-plus'} /></span></button></h3><div id={'faq-answer-' + index} role="region" aria-labelledby={'faq-question-' + index} hidden={expanded !== index}><p>{index === 0 && !campaignActive ? t('campaign.regular') : answer}</p></div></div>)}</div></div></section>
}

export function Footer({ homePath = '' }: { homePath?: string }) {
  const localHref = useLocalizedHref()
  useLocale()
  return <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-grid"><div><a className="landing-brand-link" href={localHref(homePath + '#top')} aria-label={t('navigation.homeLabel')}><BrandLogo /></a><p>{t('footer.description')}</p><div className="landing-social"><a href={business.socialProfiles.instagram} aria-label="Instagram"><Icon name="instagram" /></a><a href={business.socialProfiles.facebook} aria-label="Facebook"><Icon name="facebook" /></a><a href={'mailto:' + business.publicEmail} aria-label={t('footer.email')}><Icon name="social-mail" /></a></div><div className="landing-footer-contact"><a href={'mailto:' + business.publicEmail}>{business.publicEmail}</a><a href={business.phoneHref} onClick={() => trackEvent('phone_click')}>{business.phoneDisplay}</a></div></div><div><h2>{t('navigation.services')}</h2><a href={localHref(homePath + '#services')}>{t('services.standard.title')}</a><a href={localHref(homePath + '#services')}>{t('services.deep.title')}</a><a href={localHref(homePath + '#services')}>{t('services.rental.shortTitle')}</a><a href={localHref(homePath + '#services')}>{t('services.moving.shortTitle')}</a></div><div><h2>{t('navigation.areas')}</h2><a href={localHref(homePath + '#areas')}>{t('areas.hartfordShort')}</a><a href={localHref(homePath + '#areas')}>{t('areas.bostonShort')}</a><a href={localHref(homePath + '#areas')}>{t('areas.missingTown')}</a></div><div><h2>{t('footer.company')}</h2><a href={localHref(homePath + '#about')}>{t('footer.about')}</a><a href={localHref(homePath + '#faq')}>{t('navigation.faq')}</a><CleaningTeamLink /><a href={'mailto:' + business.publicEmail}>{t('footer.contact')}</a></div></div><div className="landing-footer-bottom"><p>{t('footer.copyright')}</p><nav className="landing-footer-legal" aria-label={t('footer.legal')}><a href={localHref(privacyConfig.path)}>{t('common.privacy')}</a><a href={localHref(termsConfig.path)}>{t('common.terms')}</a><TrackingPreferencesButton /></nav></div></div></footer>
}

export function LandingPage({ promotionsAllowed }: { promotionsAllowed: boolean }) {
  useLocale()
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [joined, setJoined] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [anyDialogOpen, setAnyDialogOpen] = useState(false)
  const [campaignActive, setCampaignActive] = useState(() => isHolidayCampaignActive())
  const [holidayReady, setHolidayReady] = useState(false)
  const overlaysEnabled = promotionsAllowed && campaignActive
  const holidayShownThisLoad = useRef(false)
  const holidayBookingClicked = useRef(false)
  const [toast, setToast] = useState<{ message: MessageKey; kind: 'success' | 'error' | 'verification' | 'info' } | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const timer = useRef<number | null>(null)
  const showToast = useCallback((message: MessageKey, kind: 'success' | 'error' | 'verification' | 'info') => {
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
    const sync = () => setAnyDialogOpen(Boolean(document.querySelector('dialog[open], .analytics-consent')))
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true })
    sync()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!overlaysEnabled) return
    const timeout = window.setTimeout(() => setHolidayReady(true), holidayCampaign.modalDelayMs)
    return () => window.clearTimeout(timeout)
  }, [overlaysEnabled])
  useEffect(() => {
    if (!holidayReady || !overlaysEnabled || holidayShownThisLoad.current || holidayBookingClicked.current) return
    const showWhenAvailable = () => {
      if (holidayShownThisLoad.current || holidayBookingClicked.current || document.querySelector('dialog[open], .analytics-consent, .landing-nav.is-open, .language-menu') || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') || document.activeElement?.closest('form')) return
      holidayShownThisLoad.current = true
      setHolidayOpen(true)
    }
    let retry: number | undefined
    const onFocusOut = () => { retry = window.setTimeout(showWhenAvailable, 150) }
    showWhenAvailable()
    document.addEventListener('focusout', onFocusOut, true)
    return () => { document.removeEventListener('focusout', onFocusOut, true); if (retry !== undefined) window.clearTimeout(retry) }
  }, [holidayReady, overlaysEnabled, menuOpen, waitlistOpen, selectedService, anyDialogOpen])
  function open() { if (!joined) { trigger.current = document.activeElement as HTMLElement; setHolidayOpen(false); setSelectedService(null); trackEvent('waitlist_cta_click'); setWaitlistOpen(true) } }
  function dismiss() { setWaitlistOpen(false); window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })) }
  function created() { setJoined(true); showToast('waitlist.toast', 'success') }
  function bookHoliday() { holidayBookingClicked.current = true; setHolidayOpen(false) }
  function openService(service: Service) { trackServiceView(service.slug); setSelectedService(service) }
  const dialogOpen = waitlistOpen || Boolean(selectedService) || holidayOpen || anyDialogOpen
  return <CleaningTeamProvider><div className="landing-page"><Header open={open} joined={joined} menuOpen={menuOpen} setMenuOpen={setMenuOpen} /><main><Hero open={open} joined={joined} campaignActive={campaignActive} /><BrandStory /><Services openService={openService} /><HowItWorks open={open} joined={joined} /><WhyMirembe /><Areas open={open} joined={joined} /><Founders /><Faq campaignActive={campaignActive} /><section className="landing-final-cta" aria-labelledby="final-cta-heading"><div className="landing-container"><Reveal><h2 id="final-cta-heading"><Trans i18nKey="home.final.title" components={{ br: <br />, accent: <em /> }} /></h2><p>{t(campaignActive ? 'home.final.campaign' : 'home.final.regular')}</p><div className="landing-cta-group"><WaitlistButton open={open} joined={joined} /><RequestButton location="final_cta" /></div></Reveal></div></section></main><Footer /><AnalyticsConsent /><WaitlistModal open={waitlistOpen} onDismiss={dismiss} onCreated={created} onFeedback={showToast} /><ServiceDetailDialog service={getServices().find(service => service.slug === selectedService?.slug) ?? null} onDismiss={() => setSelectedService(null)} />{overlaysEnabled && <><HolidayFloatingCTA hidden={dialogOpen || menuOpen || Boolean(toast)} onBooking={bookHoliday} /><HolidayPromoModal open={holidayOpen} onDismiss={() => setHolidayOpen(false)} onBooking={bookHoliday} /></>}{toast && <div className={'landing-toast is-' + toast.kind} role={toast.kind === 'success' ? 'status' : 'alert'}><span aria-hidden="true">{toast.kind === 'success' ? '✓' : '!'}</span><p>{t(toast.message)}</p><button type="button" onClick={() => setToast(null)} aria-label={t('common.dismissNotification')}>×</button></div>}</div></CleaningTeamProvider>
}
