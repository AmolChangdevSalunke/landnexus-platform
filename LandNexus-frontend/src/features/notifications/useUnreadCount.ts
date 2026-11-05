import { useEffect } from 'react'
import { getUnreadCount } from '../../api/notifications'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useApiQuery } from '../../hooks/useApiQuery'
import { resetUnreadCount, setUnreadCount } from './notificationsSlice'

/**
 * Keeps the header unread badge in sync. Refreshes every 60 seconds only while
 * the tab is visible, and whenever the signed-in user changes.
 */
export function useUnreadCount(): number {
  const dispatch = useAppDispatch()
  const userId = useAppSelector((state) => state.auth.user?.id ?? null)
  const unread = useAppSelector((state) => state.notifications.unreadCount)
  const refreshRevision = useAppSelector(
    (state) => state.notifications.refreshRevision,
  )
  const enabled = Boolean(userId)

  const { data, reload } = useApiQuery(
    () => getUnreadCount(),
    [userId, refreshRevision],
    enabled,
  )

  useEffect(() => {
    if (data !== null) {
      dispatch(setUnreadCount(data))
    }
  }, [data, dispatch])

  useEffect(() => {
    if (!enabled) {
      dispatch(resetUnreadCount())
      return
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        reload()
      }
    }

    const timer = window.setInterval(() => {
      if (!document.hidden) {
        reload()
      }
    }, 60_000)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [dispatch, enabled, reload])

  return unread
}
