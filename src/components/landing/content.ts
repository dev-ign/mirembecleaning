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

export const services: readonly Service[] = [
  {
    slug: 'standard', title: 'Standard Clean', image: 'service_standard', icon: 'service-repeat',
    summary: 'Reliable weekly, biweekly, monthly, or one-time cleaning to keep your home fresh and comfortable.',
    lead: 'What’s included',
    items: ['Wiping counters and stovetop', 'Cleaning sinks and appliance exteriors', 'Cleaning and disinfecting bathrooms', 'Dusting reachable surfaces', 'Making beds', 'Emptying trash', 'Vacuuming and mopping floors'],
    addons: ['Inside cabinets', 'Dishes'],
    note: 'Best for: weekly, biweekly, or monthly upkeep and one-time refreshes.',
  },
  {
    slug: 'deep', title: 'Deep Clean', image: 'service_deep', icon: 'service-sparkle',
    summary: 'A detailed top-to-bottom clean for first visits, seasonal resets, holiday hosting, or whenever your home needs extra attention.',
    lead: 'Includes everything in Standard Clean, plus:',
    items: ['Hand-wiping baseboards', 'Cabinet fronts', 'Doors and door frames', 'Light switches', 'Degreasing backsplash and range hood', 'Cleaning inside refrigerator, microwave, and oven', 'Scrubbing grout and soap scum', 'Dusting ceiling fans', 'Blinds and window sills', 'Vacuuming upholstered furniture', 'Cleaning under movable furniture'],
    addons: ['Inside cabinets', 'Dishes'],
    note: 'Recommended for your first visit or before a big gathering.',
  },
  {
    slug: 'rental', title: 'Rental Turnovers & Move-In/Move-Out', image: 'service_rental', icon: 'service-key',
    summary: 'Thorough cleaning for landlords, property managers, tenants, and homeowners — helping properties become tenant-ready and photo-ready.',
    lead: 'What’s included',
    items: ['Empty-unit top-to-bottom cleaning', 'Inside cabinets and drawers', 'Inside refrigerator and oven', 'Kitchen and bathroom cleaning', 'Surface cleaning and floor care', 'Photo reports for landlords', 'Volume pricing available for five or more turnovers annually'],
    addons: ['Dishes'],
    note: 'Inside cabinets is already included in this service.',
  },
]

export const benefits = [
  { title: 'Built by Landlords', body: 'We understand what vacancies cost. Our founders are property owners too, so efficient, dependable rental turnovers matter to us.', icon: 'benefit_landlords' },
  { title: 'Safer Products', body: 'Carefully selected eco-friendly cleaning products, with fragrance-free options available for sensitive households.', icon: 'benefit_products' },
  { title: 'Simple Pricing & Booking', body: 'See your price and book online in minutes, with the option to speak with us directly.', icon: 'benefit_pricing' },
  { title: 'A Team You Can Trust', body: 'Trained, background-checked employees, insured and bonded. Whenever possible, we’ll send the same trusted cleaner back.', icon: 'benefit_team' },
  { title: 'Our Clean Guarantee', body: 'If something isn’t right, let us know within 24 hours and we’ll return to re-clean the affected areas at no cost.', icon: 'benefit_guarantee' },
  { title: 'Flexible Scheduling', body: 'Weekday appointments, with weekend and holiday availability when needed.', icon: 'benefit_schedule' },
] as const

export const areas = [
  { state: 'CONNECTICUT', title: 'Greater Hartford, Connecticut', body: 'Home and rental cleaning across Hartford and the surrounding towns of central Connecticut.', map: 'map_hartford', alt: 'Illustrated map of Greater Hartford and central Connecticut', towns: ['Hartford', 'Newington', 'West Hartford', 'Wethersfield', 'Rocky Hill', 'New Britain', 'Glastonbury'] },
  { state: 'MASSACHUSETTS', title: 'Greater Boston, Massachusetts', body: 'Home and rental cleaning across Boston, its neighborhoods, and nearby communities.', map: 'map_boston', alt: 'Illustrated map of Boston and nearby Massachusetts communities', towns: ['Boston', 'Dorchester', 'Everett', 'Cambridge', 'Somerville', 'Medford', 'Malden', 'Quincy'] },
] as const

export const faqs = [
  ['When does Mirembe Cleaning Company open?', 'We open for regular bookings in January 2027. We’re also accepting a limited number of holiday cleanings in November and December 2026.'],
  ['What areas do you serve?', 'We serve Greater Hartford, Connecticut, and Greater Boston, Massachusetts, including the communities shown above. Join the waitlist if your town is not listed so we can keep you updated.'],
  ['What’s the difference between a Standard Clean and a Deep Clean?', 'A Standard Clean keeps your home fresh and tidy. A Deep Clean includes detailed work like the inside of the oven, microwave, and fridge; baseboards; cabinet fronts; door frames; grout; ceiling fans; and blinds. We recommend a Deep Clean for your first visit or before a big gathering.'],
  ['What products do you use?', 'We plan to use carefully selected eco-friendly cleaning products, with fragrance-free options for sensitive households. Let us know about any product preferences when booking.'],
  ['Do you bring your own supplies?', 'Our team arrives with the supplies needed for your clean. If you have product preferences or a particular surface that needs special care, please tell us when booking.'],
  ['Are your cleaners insured and background-checked?', 'Our cleaning team is planned to consist of trained, background-checked employees, with insurance and bonding for added peace of mind. Please confirm the current coverage and hiring details with us before booking.'],
  ['Do I need to be home during the cleaning?', 'You can tell us your access preferences when booking. We’ll coordinate the details with you before your appointment.'],
  ['What if I’m not happy with my clean?', 'Let us know within 24 hours if something was missed and we’ll return to re-clean the affected areas at no cost. We’ll confirm the guarantee terms before your appointment.'],
  ['What is your cancellation policy?', 'Please contact us as early as possible if your plans change. We’ll confirm the cancellation terms and any applicable fees before your appointment.'],
  ['Do you clean on weekends and holidays?', 'Weekday appointments are planned, with limited weekend and holiday availability when needed. Available times are confirmed during booking.'],
  ['Do you work with landlords and property managers?', 'Yes. Our rental turnover and move-in/move-out service is designed for landlords, property managers, tenants, and homeowners. Ask us about photo reports and volume pricing for five or more turnovers a year.'],
] as const
