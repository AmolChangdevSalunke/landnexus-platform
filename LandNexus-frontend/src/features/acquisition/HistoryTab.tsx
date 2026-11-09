import { ArrowRight } from 'lucide-react'
import { getCaseHistory } from '../../api/acquisition'
import type { AcquisitionHistoryEntry, CaseResponse } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDateTime } from '../../utils/format'
import { CaseStatusBadge } from './CaseStatusBadge'
import { historyActionLabel } from './labels'

export function HistoryTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const query = useApiQuery(
    () => getCaseHistory(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  const entries = (query.data ?? [])
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Case history"
          description="Every workflow transition recorded by the backend, newest first. Reasons are shown exactly as they were recorded."
        />
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title="Could not load the case history"
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : query.isLoading ? (
        <Card className="space-y-4 p-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
          ))}
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No history recorded"
            description="Transitions appear here as soon as the workflow moves."
          />
        </Card>
      ) : (
        <Card className="p-4">
          <ol className="relative space-y-5 border-l border-slate-200 pl-5">
            {entries.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}

function HistoryRow({ entry }: { entry: AcquisitionHistoryEntry }) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600"
      />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-navy-900">
          {historyActionLabel(entry.action)}
        </h3>
        <span className="text-xs text-slate-500" title={entry.occurredAt}>
          {formatDateTime(entry.occurredAt)}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        {entry.fromStatus ? (
          <>
            <CaseStatusBadge status={entry.fromStatus} />
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
          </>
        ) : (
          <>
            <Badge variant="neutral">Start</Badge>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
          </>
        )}
        <CaseStatusBadge status={entry.toStatus} />
      </div>

      <p className="mt-1.5 text-xs text-slate-600">
        By <span className="font-medium text-slate-700">{entry.actorUsername}</span>
      </p>

      {entry.reason ? (
        <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">Reason:</span> {entry.reason}
        </p>
      ) : null}
    </li>
  )
}
