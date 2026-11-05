import { useState, type FormEvent } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { getAuditEvents } from '../../../api/admin'
import type { AuditEventResponse } from '../../../api/types'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Alert } from '../../../components/ui/Alert'
import { Badge, type BadgeVariant } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable, type TableColumn } from '../../../components/ui/DataTable'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { formatDateTime, shortId } from '../../../utils/format'

interface AuditFilters {
  entityType: string
  entityId: string
  actor: string
}

const EMPTY_FILTERS: AuditFilters = { entityType: '', entityId: '', actor: '' }

function actionVariant(action: string): BadgeVariant {
  switch (action) {
    case 'CREATE':
      return 'success'
    case 'DELETE':
      return 'danger'
    case 'DISABLE':
      return 'warning'
    case 'ENABLE':
      return 'teal'
    default:
      return 'info'
  }
}

export function AuditTrailPage() {
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_FILTERS)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const query = useApiQuery(
    () =>
      getAuditEvents({
        entityType: applied.entityType || undefined,
        entityId: applied.entityId || undefined,
        actor: applied.actor || undefined,
        page,
        size,
      }),
    [applied, page, size],
  )

  const rows = query.data?.content ?? []
  const hasFilters = Boolean(applied.entityType || applied.entityId || applied.actor)

  function updateDraft(key: keyof AuditFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    if (filterError) {
      setFilterError(null)
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: AuditFilters = {
      entityType: draft.entityType.trim(),
      entityId: draft.entityId.trim(),
      actor: draft.actor.trim(),
    }

    if (next.entityId && !next.entityType) {
      setFilterError('An entity type is required when filtering by entity id.')
      return
    }

    setFilterError(null)
    setApplied(next)
    setPage(0)
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setFilterError(null)
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  const columns: TableColumn<AuditEventResponse>[] = [
    {
      key: 'occurredAt',
      header: 'Occurred',
      render: (event) => (
        <span className="whitespace-nowrap" title={event.occurredAt}>
          {formatDateTime(event.occurredAt)}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (event) => (
        <span className="font-mono text-xs text-slate-700">{event.actorUsername}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (event) => (
        <Badge variant={actionVariant(event.action)}>{event.action}</Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (event) => (
        <div className="min-w-36">
          <p className="font-medium text-navy-900">{event.entityType}</p>
          <p className="font-mono text-xs text-slate-500" title={event.entityId ?? undefined}>
            {shortId(event.entityId)}
          </p>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (event) =>
        event.details ? (
          <details className="max-w-md">
            <summary className="cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-800">
              View details
            </summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">
              {event.details}
            </p>
          </details>
        ) : (
          <span className="text-slate-400">No details</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Administration · Audit"
        title="Audit trail"
        description="Append-only record of platform activity, newest first. Filters are exact matches and the API offers no edit or delete operation."
        actions={
          <Button
            variant="outline"
            onClick={query.reload}
            disabled={query.isLoading}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <Alert variant="info" title="Strictly read-only" className="mb-4">
        Audit events cannot be changed or removed from the application. Filters are applied by
        the backend before pagination.
      </Alert>

      <Card className="mb-4 p-4">
        <form onSubmit={applyFilters} noValidate className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Input
              label="Entity type"
              value={draft.entityType}
              onChange={(event) => updateDraft('entityType', event.target.value)}
              placeholder="e.g. Proposal"
              hint="Exact match, case-sensitive."
            />
            <Input
              label="Entity id"
              value={draft.entityId}
              onChange={(event) => updateDraft('entityId', event.target.value)}
              placeholder="UUID"
              hint="Requires an entity type."
              error={filterError ?? undefined}
            />
            <Input
              label="Actor username"
              value={draft.actor}
              onChange={(event) => updateDraft('actor', event.target.value)}
              placeholder="e.g. consultant.one"
              hint="Exact match."
            />
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                type="submit"
                leftIcon={<Search aria-hidden="true" className="h-4 w-4" />}
              >
                Apply filters
              </Button>
              {hasFilters || draft.entityType || draft.entityId || draft.actor ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </form>

        {query.data ? (
          <p className="mt-3 text-xs text-slate-500">
            {query.data.totalElements}{' '}
            {query.data.totalElements === 1 ? 'event' : 'events'}
            {hasFilters ? ' match your filters' : ' in total'}
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 403 ? 'You do not have access' : 'Could not load audit events'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(event) => event.id}
          isLoading={query.isLoading}
          caption="Audit events, newest first"
          emptyTitle={hasFilters ? 'No audit events match these filters' : 'No audit events yet'}
          emptyDescription={
            hasFilters
              ? 'Check the exact entity type, entity id or actor username.'
              : 'Activity is recorded automatically when the backend performs a write.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
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

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">Append only</Badge>
        The backend records the actor, action, entity and a details summary for each event.
      </p>
    </>
  )
}
