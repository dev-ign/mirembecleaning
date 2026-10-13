import { isValidEmail } from '../../src/shared/email.js'

export interface EmailConfig {
  apiKey: string
  from: string
  careersFrom: string
  notificationEmail: string
}

function sender(value: string | undefined, defaultName: string): string | null {
  const input = value?.trim()
  if (!input || /[\r\n]/.test(input)) return null
  const wrapped = input.match(/^([^<>]*)<([^<>]+)>$/)
  const address = (wrapped?.[2] ?? input).trim()
  if (!isValidEmail(address) || !address.toLowerCase().endsWith('@mirembecleaning.com')) return null
  return `${wrapped?.[1].trim() || defaultName} <${address}>`
}

export function getEmailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = sender(process.env.RESEND_FROM_EMAIL, 'Mirembe Cleaning')
  const careersFrom = sender(process.env.RESEND_CAREERS_EMAIL, 'Mirembe Cleaning Careers')
  const notificationEmail = process.env.MIREMBE_NOTIFICATION_EMAIL?.trim().toLowerCase()
  if (!apiKey || !from || !careersFrom || !notificationEmail || !isValidEmail(notificationEmail)) return null
  return { apiKey, from, careersFrom, notificationEmail }
}
