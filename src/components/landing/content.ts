import { t } from '../../i18n'
export type Service = {
  slug: 'standard' | 'deep' | 'rental'
  title: string
  summary: string
  image: string
  icon: string
  lead: string
  items: readonly string[]
  addons: readonly string[]
  note: string
}

export function getServices(): readonly Service[] { return [
  {
    slug: 'standard', title: t('services.standard.title'), image: 'service_standard', icon: 'service-repeat',
    summary: t('services.standard.summary'),
    lead: t('services.included'),
    items: [t('services.checklist.counters'), t('services.checklist.sinks'), t('services.checklist.bathrooms'), t('services.checklist.dusting'), t('services.checklist.beds'), t('services.checklist.trash'), t('services.checklist.floors')],
    addons: [t('services.cabinets'), t('services.dishes')],
    note: t('services.standard.note'),
  },
  {
    slug: 'deep', title: t('services.deep.title'), image: 'service_deep', icon: 'service-sparkle',
    summary: t('services.deep.summary'),
    lead: t('services.deep.lead'),
    items: [t('services.checklist.baseboards'), t('services.checklist.cabinetFronts'), t('services.checklist.doors'), t('services.checklist.switches'), t('services.checklist.degreasing'), t('services.checklist.applianceInteriors'), t('services.checklist.grout'), t('services.checklist.fans'), t('services.checklist.blinds'), t('services.checklist.upholstery'), t('services.checklist.underFurniture')],
    addons: [t('services.cabinets'), t('services.dishes')],
    note: t('services.deep.note'),
  },
  {
    slug: 'rental', title: t('services.rental.title'), image: 'service_rental', icon: 'service-key',
    summary: t('services.rental.summary'),
    lead: t('services.included'),
    items: [t('services.checklist.emptyUnit'), t('services.checklist.cabinetsDrawers'), t('services.checklist.fridgeOven'), t('services.checklist.kitchenBathroom'), t('services.checklist.surfacesFloors'), t('services.checklist.photoReports'), t('services.checklist.volume')],
    addons: [t('services.dishes')],
    note: t('services.rental.note'),
  },
]
}

export function getBenefits() { return [
  { title: t('benefits.landlords.title'), body: t('benefits.landlords.body'), icon: 'benefit_landlords' },
  { title: t('benefits.products.title'), body: t('benefits.products.body'), icon: 'benefit_products' },
  { title: t('benefits.pricing.title'), body: t('benefits.pricing.body'), icon: 'benefit_pricing' },
  { title: t('benefits.team.title'), body: t('benefits.team.body'), icon: 'benefit_team' },
  { title: t('benefits.guarantee.title'), body: t('benefits.guarantee.body'), icon: 'benefit_guarantee' },
  { title: t('benefits.schedule.title'), body: t('benefits.schedule.body'), icon: 'benefit_schedule' },
] as const
}

export function getAreas() { return [
  { state: 'CONNECTICUT', title: t('areas.hartford.title'), body: t('areas.hartford.body'), map: 'map_hartford', alt: t('areas.hartford.alt'), towns: ['Hartford', 'Newington', 'West Hartford', 'Wethersfield', 'Rocky Hill', 'New Britain', 'Glastonbury'] },
  { state: 'MASSACHUSETTS', title: t('areas.boston.title'), body: t('areas.boston.body'), map: 'map_boston', alt: t('areas.boston.alt'), towns: ['Boston', 'Dorchester', 'Everett', 'Cambridge', 'Somerville', 'Medford', 'Malden', 'Quincy'] },
] as const
}

export function getFaqs() { return [
  [t('faq.opening.question'), t('faq.opening.answer')],
  [t('faq.areas.question'), t('faq.areas.answer')],
  [t('faq.cleanTypes.question'), t('faq.cleanTypes.answer')],
  [t('faq.products.question'), t('faq.products.answer')],
  [t('faq.supplies.question'), t('faq.supplies.answer')],
  [t('faq.trust.question'), t('faq.trust.answer')],
  [t('faq.access.question'), t('faq.access.answer')],
  [t('faq.guarantee.question'), t('faq.guarantee.answer')],
  [t('faq.cancellation.question'), t('faq.cancellation.answer')],
  [t('faq.schedule.question'), t('faq.schedule.answer')],
  [t('faq.landlords.question'), t('faq.landlords.answer')],
] as const
}
