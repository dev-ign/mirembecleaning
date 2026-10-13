import type { JWT } from 'google-auth-library'
import { createGoogleAuth, type SheetsConfig } from './config.js'
import { SHEET_TABS, type SheetKind } from './mapping.js'

export class SheetsApiError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) { super(code) }
}

function range(kind: SheetKind, cells: string): string {
  return `'${SHEET_TABS[kind].name.replace(/'/g, "''")}'!${cells}`
}

export class SheetsClient {
  private readonly auth: JWT
  constructor(private readonly config: SheetsConfig) { this.auth = createGoogleAuth(config) }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
    let token: string | null | undefined
    try { token = (await this.auth.getAccessToken()).token }
    catch { throw new SheetsApiError('google_auth_failed', true) }
    if (!token) throw new SheetsApiError('google_auth_failed', true)
    let response: Response
    try {
      response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8_000),
      })
    } catch { throw new SheetsApiError('google_network_failed', true) }
    if (!response.ok) {
      throw new SheetsApiError(`google_http_${response.status}`,
        response.status === 408 || response.status === 429 || response.status >= 500)
    }
    try { return await response.json() as T }
    catch { throw new SheetsApiError('google_invalid_response', true) }
  }

  async inspect(kind: SheetKind): Promise<{ ids: Set<string>; header: string[] }> {
    const tab = SHEET_TABS[kind]
    const query = new URLSearchParams()
    query.append('ranges', range(kind, `A1:${kind === 'waitlist' ? 'E' : 'J'}1`))
    query.append('ranges', range(kind, 'A2:A'))
    query.set('valueRenderOption', 'UNFORMATTED_VALUE')
    const data = await this.request<{ valueRanges?: { values?: unknown[][] }[] }>('GET', `/values:batchGet?${query}`)
    if (!Array.isArray(data.valueRanges) || data.valueRanges.length !== 2) {
      throw new SheetsApiError('google_invalid_response', true)
    }
    const header = (data.valueRanges[0].values?.[0] ?? []).map(String)
    const ids = new Set((data.valueRanges[1].values ?? []).map((row) => row[0]).filter((id): id is string => typeof id === 'string'))
    // A missing or edited header means the column mapping cannot be trusted.
    if (header.length && !tab.headers.every((value, index) => header[index] === value)) {
      throw new SheetsApiError('sheet_header_mismatch', false)
    }
    return { ids, header }
  }

  async append(kind: SheetKind, values: string[]): Promise<void> {
    const tab = SHEET_TABS[kind]
    if (values.length !== tab.headers.length) throw new SheetsApiError('sheet_column_mismatch', false)
    const query = new URLSearchParams({ valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' })
    const result = await this.request<{ updates?: { updatedRows?: number } }>('POST',
      `/values/${encodeURIComponent(range(kind, `A:${kind === 'waitlist' ? 'E' : 'J'}`))}:append?${query}`,
      { majorDimension: 'ROWS', values: [values] })
    if (result.updates?.updatedRows !== 1) throw new SheetsApiError('google_append_unconfirmed', true)
  }

  async prepareTabs(): Promise<void> {
    const metadata = await this.request<{ sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number } } }[] }>(
      'GET', '?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))')
    const plans = [] as { kind: SheetKind; sheetId: number; hasHeader: boolean }[]
    for (const kind of ['waitlist', 'hiring'] as const) {
      const tab = SHEET_TABS[kind]
      const sheetId = metadata.sheets?.find((sheet) => sheet.properties?.title === tab.name)?.properties?.sheetId
      if (sheetId === undefined) throw new SheetsApiError('sheet_tab_missing', false)
      const inspection = await this.inspect(kind)
      plans.push({ kind, sheetId, hasHeader: inspection.header.length > 0 })
    }
    // Check both tabs before writing either one, so incompatible layouts do not
    // leave the spreadsheet half prepared.
    for (const { kind, sheetId, hasHeader } of plans) {
      const tab = SHEET_TABS[kind]
      if (!hasHeader) {
        await this.request('PUT', `/values/${encodeURIComponent(range(kind, `A1:${kind === 'waitlist' ? 'E' : 'J'}1`))}?valueInputOption=RAW`,
          { majorDimension: 'ROWS', values: [tab.headers] })
      }
      const endColumnIndex = tab.headers.length
      const requests: unknown[] = [
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endColumnIndex } } } },
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, endColumnIndex }, cell: {
          userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            backgroundColor: { red: 0.16, green: 0.22, blue: 0.21 }, verticalAlignment: 'MIDDLE' },
        }, fields: 'userEnteredFormat' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 36 }, fields: 'pixelSize' } },
        ...tab.widths.map((pixelSize, index) => ({ updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
          properties: { pixelSize }, fields: 'pixelSize',
        } })),
      ]
      await this.request('POST', ':batchUpdate', { requests })
    }
  }
}
