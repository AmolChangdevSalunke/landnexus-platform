import { useState } from 'react'
import { getNotifications, markNotificationRead } from '../../api/notifications'
import { toApiErrorInfo } from '../../api/errors'
import type { NotificationItem } from '../../api/types'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDateTime } from '../../utils/format'
import { decrementUnreadCount } from './notificationsSlice'
import { notificationTarget, notificationTypeLabel } from './notificationTarget'

const ALL_NOTIFICATIONS = 'all'
const UNREAD_ONLY = 'unread'

export function NotificationListPage() {
  const dispatch = useAppDispatch()
  const [filter, setFilter] = useState<typeof ALL_NOTIFICATIONS | typeof UNREAD_ONLY>(
    ALL_NOTIFICATIONS,
  )
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const mutation = useApiMutation<NotificationItem>()

  const unreadOnly = filter === UNREAD_ONLY
  const query = useApiQuery(
    () => getNotifications(unreadOnly, page, size),
    [unreadOnly, page, size],
  )

  const rows = query.data?.content ?? []

  function changeFilter(next: string) {
    setFilter(next === UNREAD_ONLY ? UNREAD_ONLY : ALL_NOTIFICATIONS)
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  async function markRead(notification: NotificationItem) {
    if (notification.read) {
      return
    }

    setMarkingId(notification.id)
    try {
      await mutation.mutate(() => markNotificationRead(notification.id))
      dispatch(decrementUnreadCount())
      dispatch(
        addToast({
          variant: 'success',
          message: 'Notification marked as read.',
        }),
      )
      query.reload()
    } catch (caught: unknown) {
      dispatch(
        addToast({
          variant: 'error',
          title: 'Could not mark notification as read',
          message: toApiErrorInfo(caught).message,
        }),
      )
    } finally {
      setMarkingId(null)
    }
  }

  const columns: TableColumn<NotificationItem>[] = [
    {
      key: 'notification',
      header: 'Notification',
      render: (notification) => (
        <div className="min-w-64 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-navy-900">{notification.title}</p>
            {!notification.read ? <Badge variant="info">Unread</Badge> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
          <p className="mt-1 text-xs text-slate-500">
            {notificationTypeLabel(notification.type)}
          </p>
        </div>
      ),
    },
    {
      key: 'received',
      header: 'Received',
      render: (notification) => (
        <span className="whitespace-nowrap" title={notification.createdAt}>
          {formatDateTime(notification.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (notification) => {
        const target = notificationTarget(notification)
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {!notification.read ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markRead(notification)}
                isLoading={mutation.isLoading && markingId === notification.id}
              >
                Mark as read
              </Button>
            ) : null}
            {target ? (
              <LinkButton to={target} variant="outline" size="sm">
                Open
              </LinkButton>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="Your own workflow and account notifications. Only the backend can decide which notifications belong to you."
        actions={
          <Button variant="outline" onClick={query.reload} disabled={query.isLoading}>
            Refresh
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:items-end">
          <Select
            label="Show"
            value={filter}
            onChange={(event) => changeFilter(event.target.value)}
          >
            <option value={ALL_NOTIFICATIONS}>All notifications</option>
            <option value={UNREAD_ONLY}>Unread only</option>
          </Select>

          <div className="lg:text-right">
            {query.data ? (
              <p className="text-xs text-slate-500">
                {query.data.totalElements}{' '}
                {query.data.totalElements === 1 ? 'notification' : 'notifications'}
                {unreadOnly ? ' unread' : ' visible to you'}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 401
                ? 'Your session has expired'
                : 'Could not load notifications'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(notification) => notification.id}
          isLoading={query.isLoading}
          caption="Your notifications"
          emptyTitle={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          emptyDescription={
            unreadOnly
              ? 'Everything has been read. Switch to all notifications to review earlier items.'
              : 'Workflow and account notifications for you will appear here.'
          }
          emptyAction={
            unreadOnly ? (
              <Button variant="outline" onClick={() => changeFilter(ALL_NOTIFICATIONS)}>
                Show all notifications
              </Button>
            ) : undefined
          }
          page={query.data?.page ?? page}
          size={query.data?.size ?? size}
          totalElements={query.data?.totalElements ?? 0}
          totalPages={query.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={changeSize}
        />
      )}
    </>
  )
}
