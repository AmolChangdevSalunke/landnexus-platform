import { useState } from 'react'
import { getAuditEvents } from '../../../api/admin'
import type { AuditEventResponse, UserResponse } from '../../../api/types'
import { DataTable, type TableColumn } from '../../../components/ui/DataTable'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Modal } from '../../../components/ui/Modal'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { formatDateTime } from '../../../utils/format'

export function UserActivityDialog({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const query = useApiQuery(
    () => getAuditEvents({ entityType: 'UserAccount', entityId: user.id, page, size }),
    [user.id, page, size],
  )
  const columns: TableColumn<AuditEventResponse>[] = [
    { key: 'date', header: 'When', render: (event) => formatDateTime(event.occurredAt) },
    { key: 'actor', header: 'Actor', render: (event) => event.actorUsername },
    { key: 'action', header: 'Action', render: (event) => <span className="font-mono text-xs">{event.action}</span> },
    { key: 'details', header: 'Details', render: (event) => <span className="break-all text-xs">{event.details ?? '—'}</span> },
  ]

  return (
    <Modal title={`User activity · ${user.username}`} description="Append-only account, role, scope and permission audit events." size="lg" onClose={onClose}>
      {query.error ? <ErrorState title="Could not load user activity" message={query.error.message} onRetry={query.reload} /> : null}
      <DataTable
        columns={columns}
        rows={query.data?.content ?? []}
        rowKey={(event) => event.id}
        isLoading={query.isLoading}
        caption="User audit history"
        emptyTitle="No user activity found"
        emptyDescription="Audit events for this user will appear here."
        page={query.data?.page ?? page}
        size={query.data?.size ?? size}
        totalElements={query.data?.totalElements ?? 0}
        totalPages={query.data?.totalPages}
        onPageChange={setPage}
        onSizeChange={(next) => {
          setSize(next)
          setPage(0)
        }}
      />
    </Modal>
  )
}
