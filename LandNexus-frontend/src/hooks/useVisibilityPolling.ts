import { useEffect, useRef } from 'react'

/** Default refresh interval for monitoring screens. */
export const POLL_INTERVAL_MS = 30_000

/**
 * Runs `onPoll` on an interval only while the browser tab is visible.
 *
 * The interval is stopped when the tab is hidden and restarted when it becomes
 * visible again, with one immediate refresh so the user never looks at stale
 * data after returning to the tab. The latest callback is held in a ref so an
 * inline function does not restart the timer on every render.
 */
export function useVisibilityPolling(
  onPoll: () => void,
  intervalMs: number = POLL_INTERVAL_MS,
  enabled = true,
): void {
  const onPollRef = useRef(onPoll)
  onPollRef.current = onPoll

  useEffect(() => {
    if (!enabled) {
      return
    }

    let timer: number | null = null

    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
    }

    const start = () => {
      stop()
      timer = window.setInterval(() => onPollRef.current(), intervalMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onPollRef.current()
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') {
      start()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, intervalMs])
}
