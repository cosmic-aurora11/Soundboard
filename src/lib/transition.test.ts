import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LatestTransition } from './transition'

describe('LatestTransition', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs a scheduled transition', () => {
    const callback = vi.fn()
    const transition = new LatestTransition()
    transition.schedule(800, callback)
    vi.advanceTimersByTime(799)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledOnce()
  })

  it('cancels an older selection when a newer one arrives', () => {
    const first = vi.fn()
    const latest = vi.fn()
    const transition = new LatestTransition()
    transition.schedule(800, first)
    vi.advanceTimersByTime(300)
    transition.schedule(800, latest)
    vi.runAllTimers()
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
  })

  it('invalidates transition tokens on cancel', () => {
    const transition = new LatestTransition()
    const token = transition.currentToken()
    transition.cancel()
    expect(transition.isCurrent(token)).toBe(false)
  })
})
