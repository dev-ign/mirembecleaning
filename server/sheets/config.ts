import { JWT } from 'google-auth-library'

export interface SheetsConfig {
  email: string
  privateKey: string
  spreadsheetId: string
}

export function getSheetsConfig(): SheetsConfig | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()
  if (!email?.endsWith('.gserviceaccount.com') || !privateKey?.includes('-----BEGIN PRIVATE KEY-----')
    || !privateKey.includes('-----END PRIVATE KEY-----') || !spreadsheetId
    || !/^[\w-]+$/.test(spreadsheetId)) return null
  return { email, privateKey, spreadsheetId }
}

export function createGoogleAuth(config: SheetsConfig): JWT {
  return new JWT({
    email: config.email,
    key: config.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}
