import { describe, expect, it } from 'vitest'
import { timelineProgress } from '../lib/timelineProgress'

describe('How It Works rail progress', () => {
  it('fills as the viewport marker moves through the measured rail', () => {
    expect(timelineProgress(600, 300, 900)).toBe(0)
    expect(timelineProgress(390, 300, 900)).toBe(0.5)
    expect(timelineProgress(240, 300, 900)).toBe(1)
  })

  it('clamps at the ends and handles a zero-height rail', () => {
    expect(timelineProgress(1000, 300, 900)).toBe(0)
    expect(timelineProgress(-1000, 300, 900)).toBe(1)
    expect(timelineProgress(100, 0, 900)).toBe(0)
  })
})
