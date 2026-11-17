import type { SupportedLocale } from '../i18n/config.js'

// Approved disclosure record; new disclosure wording requires a new version.
// The founder-approved policy revision is current; existing provider evidence is never rewritten.
export const newsletterConsent = {
  version: 'newsletter-2026-11-17-v1',
  source: 'website_newsletter_subscribe',
  privacyPolicyVersion: '2026-11-17',
  privacyPolicyUrl: 'https://www.mirembecleaning.com/privacy',
  disclosure: {
    en: 'By subscribing, you agree to receive marketing emails from Mirembe Cleaning. You can unsubscribe at any time. See our <privacy>Privacy Policy</privacy>.',
    es: 'Al suscribirte, aceptas recibir correos de marketing de Mirembe Cleaning. Puedes cancelar tu suscripción en cualquier momento. Consulta nuestra <privacy>Política de privacidad</privacy>.',
    ht: 'Lè ou abòne, ou dakò resevwa imèl maketing nan men Mirembe Cleaning. Ou ka dezabòne nenpòt ki lè. Gade <privacy>Règleman sou vi prive</privacy> nou an.',
    pt: 'Ao se inscrever, você concorda em receber e-mails de marketing da Mirembe Cleaning. Você pode cancelar a inscrição a qualquer momento. Consulte nossa <privacy>Política de Privacidade</privacy>.',
  },
} as const

export interface NewsletterSubscriptionRequest {
  email: string
  marketingConsent: true
  consentVersion: typeof newsletterConsent.version
  locale: SupportedLocale
  turnstileToken: string
}

export function normalizeNewsletterEmail(value: string): string {
  const email = value.trim()
  const at = email.lastIndexOf('@')
  return at < 0 ? email : email.slice(0, at + 1) + email.slice(at + 1).toLowerCase()
}
