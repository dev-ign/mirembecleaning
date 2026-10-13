export type SheetKind = 'waitlist' | 'hiring'

export const SHEET_TABS = {
  waitlist: { name: 'Customer Waitlist', headers: ['Submission ID', 'Email', 'Date Joined', 'Status', 'Notes'], widths: [275, 245, 175, 125, 300] },
  hiring: { name: 'Cleaning Applicants', headers: ['Submission ID', 'First Name', 'Last Name', 'Email', 'Phone', 'City', 'State', 'Application Date', 'Status', 'Notes'], widths: [275, 145, 145, 245, 135, 160, 85, 175, 125, 300] },
} as const

export interface SubmissionRow {
  id: string
  email: string
  created_at: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
}

// RAW prevents Sheets from parsing formulas. The prefix also protects values
// subsequently copied or re-entered by a spreadsheet user.
export function sheetText(value: string | null | undefined): string {
  const text = value ?? ''
  return /^[\s]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text
}

export function sheetDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid submission date')
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function mapSubmission(kind: SheetKind, row: SubmissionRow): string[] {
  if (kind === 'waitlist') {
    return [row.id, sheetText(row.email), sheetDate(row.created_at), 'New', '']
  }
  return [row.id, sheetText(row.first_name), sheetText(row.last_name), sheetText(row.email),
    sheetText(row.phone), sheetText(row.city), sheetText(row.state), sheetDate(row.created_at), 'New', '']
}
