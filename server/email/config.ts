import { isValidEmail } from '../../src/shared/email.js'

export interface EmailConfig {
  apiKey: string
  from: string
  careersFrom: string
  notificationEmail: string
}

function sender(value: string | undefined): string | null {
  const input = value?.trim()
  if (!input || /[\r\n]/.test(input)) return null
  const address = input.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? input
  return isValidEmail(address) && address.toLowerCase().endsWith('@mirembecleaning.com') ? input : null
}

export function getEmailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = sender(process.env.RESEND_FROM_EMAIL)
  const careersFrom = sender(process.env.RESEND_CAREERS_EMAIL)
  const notificationEmail = process.env.MIREMBE_NOTIFICATION_EMAIL?.trim().toLowerCase()
  if (!apiKey || !from || !careersFrom || !notificationEmail || !isValidEmail(notificationEmail)) return null
  return { apiKey, from, careersFrom, notificationEmail }
}
