import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { toApiErrorInfo } from '../../api/errors'
import { getNotifications, markNotificationRead } from '../../api/notifications'
import type { NotificationItem } from '../../api/types'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { cn } from '../../utils/cn'
import { formatDateTime } from '../../utils/format'
import { decrementUnreadCount } from './notificationsSlice'
import { notificationTarget } from './notificationTarget'

function notificationLabel(unread: number): string {
  if (unread <= 0) {
    return 'Notifications, no unread items'
  }
  return `Notifications, ${unread} unread`
}

export function NotificationsMenu({ unread }: { unread: number }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mutation = useApiMutation<NotificationItem>()
  const query = useApiQuery(
    () => getNotifications(false, 0, 5),
    [open],
    open,
  )

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function openNotification(notification: NotificationItem) {
    setOpen(false)
    const target = notificationTarget(notification)

    if (!notification.read) {
      try {
        await mutation.mutate(() => markNotificationRead(notification.id))
        dispatch(decrementUnreadCount())
      } catch (caught: unknown) {
        dispatch(
          addToast({
            variant: 'error',
            title: 'Could not mark notification as read',
            message: toApiErrorInfo(caught).message,
          }),
        )
      }
    }

    if (target) {
      navigate(target)
    }
  }

  const items = query.data?.content ?? []

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={notificationLabel(unread)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Notifications"
        className="relative rounded-lg p-2 text-slate-200 hover:bg-white/10"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Recent notifications"
          className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-navy-900">Notifications</p>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              View all
            </Link>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {query.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : query.error ? (
              <div className="px-4 py-5 text-center">
                <p role="alert" className="text-sm text-danger-700">
                  {query.error.message}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={query.reload}
                >
                  Try again
                </Button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void openNotification(notification)}
                      className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          notification.read ? 'bg-slate-300' : 'bg-blue-600',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-navy-900">
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                          {notification.message}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{formatDateTime(notification.createdAt)}</span>
                          {!notification.read ? (
                            <span className="font-semibold text-blue-700">Unread</span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-center">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              Open notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
