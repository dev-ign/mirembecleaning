import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bookingConfig } from '../config/booking'

beforeEach(() => {
  vi.resetModules()
  document.getElementById('mirembe-zenmaid-loader')?.remove()
  delete window.zenmaid
})

describe('official ZenMaid document loader', () => {
  it('queues the Holiday form and inserts one async script across repeated calls', async () => {
    const { loadZenMaid } = await import('../lib/zenmaid')
    const first = loadZenMaid()
    const second = loadZenMaid()
    expect(first).toBe(second)
    expect(window.zenmaid).toEqual([['js', expect.any(Date)], ['config', 'V4Q5E']])
    const script = document.querySelector<HTMLScriptElement>('#mirembe-zenmaid-loader')!
    expect(script.src).toBe(bookingConfig.scriptUrl)
    expect(script.async).toBe(true)
    expect(document.querySelectorAll(`script[src="${bookingConfig.scriptUrl}"]`)).toHaveLength(1)
    script.dispatchEvent(new Event('load'))
    await expect(first).resolves.toBeUndefined()
    await expect(loadZenMaid()).resolves.toBeUndefined()
    expect(window.zenmaid).toHaveLength(2)
  })

  it('rejects script failure without retrying or adding duplicate vendor commands', async () => {
    const { loadZenMaid } = await import('../lib/zenmaid')
    const result = loadZenMaid()
    const assertion = expect(result).rejects.toThrow('Booking script unavailable')
    document.getElementById('mirembe-zenmaid-loader')!.dispatchEvent(new Event('error'))
    await assertion
    expect(loadZenMaid()).toBe(result)
    expect(window.zenmaid).toHaveLength(2)
    expect(document.getElementById('mirembe-zenmaid-loader')).toBeInTheDocument()
  })
})
