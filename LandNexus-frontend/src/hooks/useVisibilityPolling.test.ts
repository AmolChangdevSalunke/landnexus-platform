import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useVisibilityPolling } from './useVisibilityPolling'

const INTERVAL = 30_000

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(next: DocumentVisibilityState) {
  visibility = next
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('useVisibilityPolling', () => {
  it('polls every interval while the tab is visible', () => {
    const onPoll = vi.fn()
    renderHook(() => useVisibilityPolling(onPoll, INTERVAL))

    act(() => {
      vi.advanceTimersByTime(INTERVAL)
    })
    expect(onPoll).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(INTERVAL)
    })
    expect(onPoll).toHaveBeenCalledTimes(2)
  })

  it('pauses polling while the tab is hidden', () => {
    const onPoll = vi.fn()
    renderHook(() => useVisibilityPolling(onPoll, INTERVAL))

    setVisibility('hidden')
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3)
    })

    expect(onPoll).not.toHaveBeenCalled()
  })

  it('refreshes immediately and resumes polling when the tab becomes visible', () => {
    const onPoll = vi.fn()
    renderHook(() => useVisibilityPolling(onPoll, INTERVAL))

    setVisibility('hidden')
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 2)
    })
    expect(onPoll).not.toHaveBeenCalled()

    setVisibility('visible')
    expect(onPoll).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(INTERVAL)
    })
    expect(onPoll).toHaveBeenCalledTimes(2)
  })

  it('stops the timer when the component unmounts', () => {
    const onPoll = vi.fn()
    const { unmount } = renderHook(() => useVisibilityPolling(onPoll, INTERVAL))

    unmount()
    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3)
    })

    expect(onPoll).not.toHaveBeenCalled()
  })

  it('does not poll when disabled', () => {
    const onPoll = vi.fn()
    renderHook(() => useVisibilityPolling(onPoll, INTERVAL, false))

    act(() => {
      vi.advanceTimersByTime(INTERVAL * 3)
    })
    setVisibility('hidden')
    setVisibility('visible')

    expect(onPoll).not.toHaveBeenCalled()
  })

  it('uses the latest callback without restarting the timer', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onPoll }) => useVisibilityPolling(onPoll, INTERVAL), {
      initialProps: { onPoll: first },
    })

    rerender({ onPoll: second })
    act(() => {
      vi.advanceTimersByTime(INTERVAL)
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
