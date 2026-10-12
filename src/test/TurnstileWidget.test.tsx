import { createRef } from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TurnstileWidget, type TurnstileWidgetHandle } from '../components/TurnstileWidget'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Turnstile widget', () => {
  it('renders the managed challenge, clears expired tokens, and resets after a request', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'public-test-key')
    const renderWidget = vi.fn((container: HTMLElement, options: Record<string, unknown>) => {
      expect(container).toBeInstanceOf(HTMLElement)
      expect(options).toBeDefined()
      return 'widget-1'
    })
    const reset = vi.fn()
    const remove = vi.fn()
    vi.stubGlobal('turnstile', { render: renderWidget, reset, remove })
    const onStatusChange = vi.fn()
    const ref = createRef<TurnstileWidgetHandle>()
    const view = render(<TurnstileWidget ref={ref} action="waitlist" onStatusChange={onStatusChange} />)

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1))
    const options = renderWidget.mock.calls[0][1]
    expect(options).toMatchObject({ sitekey: 'public-test-key', action: 'waitlist', appearance: 'interaction-only' })
    const solve = options.callback as (token: string) => void
    solve('fresh-token')
    expect(onStatusChange).toHaveBeenCalledWith('verified', 'fresh-token')
    const expire = options['expired-callback'] as () => void
    expire()
    expect(onStatusChange).toHaveBeenLastCalledWith('expired')

    ref.current?.reset()
    expect(reset).toHaveBeenCalledExactlyOnceWith('widget-1')
    expect(onStatusChange).toHaveBeenLastCalledWith('loading')
    view.unmount()
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget-1')
  })
})
