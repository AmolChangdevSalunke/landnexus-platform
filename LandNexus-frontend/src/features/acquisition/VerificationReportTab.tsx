import { getVerificationReport } from '../../api/acquisition'
import type { CaseResponse, ParcelReportRow } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatArea, formatDateTime, shortId } from '../../utils/format'
import {
  SURVEY_STATE_LABELS,
  SURVEY_STATE_VARIANTS,
  formatGps,
} from './labels'

export function VerificationReportTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const query = useApiQuery(
    () => getVerificationReport(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  if (query.isLoading) {
    return (
      <Card className="space-y-3 p-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    )
  }

  if (query.error) {
    return (
      <Card>
        <ErrorState
          title="Could not load the verification report"
          message={query.error.message}
          onRetry={query.reload}
        />
      </Card>
    )
  }

  if (!query.data) {
    return (
      <Card>
        <EmptyState
          title="No verification report yet"
          description="The report appears once parcels are identified for this case."
        />
      </Card>
    )
  }

  const report = query.data
  const verifiedShare =
    report.totalParcels > 0 ? (report.verified / report.totalParcels) * 100 : 0

  const columns: TableColumn<ParcelReportRow>[] = [
    {
      key: 'parcel',
      header: 'Parcel',
      render: (row) => (
        <div className="min-w-40">
          <p className="font-mono text-xs font-semibold text-navy-900" title={row.parcelId}>
            {shortId(row.parcelId)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500" title={row.caseParcelId}>
            Case parcel {shortId(row.caseParcelId)}
          </p>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'Survey state',
      render: (row) => (
        <Badge variant={SURVEY_STATE_VARIANTS[row.surveyState]}>
          {SURVEY_STATE_LABELS[row.surveyState]}
        </Badge>
      ),
    },
    {
      key: 'area',
      header: 'Area to acquire',
      render: (row) => formatArea(row.areaToAcquireHa),
    },
    {
      key: 'recorded',
      header: 'Recorded area',
      render: (row) => formatArea(row.recordedAreaHa),
    },
    {
      key: 'measured',
      header: 'Measured area',
      render: (row) => formatArea(row.measuredAreaHa),
    },
    {
      key: 'variance',
      header: 'Variance',
      render: (row) =>
        row.variancePercent === null ? (
          '—'
        ) : (
          <Badge variant={Math.abs(row.variancePercent) > 10 ? 'warning' : 'neutral'}>
            {row.variancePercent.toFixed(2)}%
          </Badge>
        ),
    },
    {
      key: 'gps',
      header: 'GPS point',
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-xs text-slate-600">
          {formatGps(row.gpsLatitude, row.gpsLongitude)}
        </span>
      ),
    },
    {
      key: 'surveyor',
      header: 'Surveyor',
      render: (row) => (
        <div className="min-w-32 text-xs text-slate-600">
          <p>{row.surveyorUsername ?? '—'}</p>
          <p className="text-[10px] text-slate-500">
            Verified {formatDateTime(row.verifiedAt)}
          </p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Verification report"
          description="A parcel-by-parcel view of survey progress for this case. The backend computes the counts."
          action={
            <Badge variant={report.verified === report.totalParcels ? 'success' : 'warning'}>
              {report.verified}/{report.totalParcels} verified
            </Badge>
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Summary label="Verified" value={report.verified} tone="success" />
          <Summary label="Awaiting verification" value={report.awaitingVerification} tone="warning" />
          <Summary label="Rejected only" value={report.rejectedOnly} tone="danger" />
          <Summary label="Not surveyed" value={report.notSurveyed} tone="neutral" />
          <Summary
            label="Area to acquire"
            value={formatArea(report.totalAreaToAcquireHa)}
            tone="info"
          />
        </div>

        <div className="mt-4">
          <div
            role="progressbar"
            aria-label="Verified parcels"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(verifiedShare)}
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-success-600"
              style={{ width: `${Math.min(100, Math.max(0, verifiedShare))}%` }}
            />
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={report.parcels}
        rowKey={(row) => row.caseParcelId}
        caption={`Verification report for ${report.caseNumber}`}
        emptyTitle="No parcels in this report"
        emptyDescription="Identify the affected parcels first."
      />
    </div>
  )
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
}) {
  const border = {
    success: 'border-l-success-600',
    warning: 'border-l-warning-600',
    danger: 'border-l-danger-600',
    neutral: 'border-l-slate-400',
    info: 'border-l-blue-600',
  }[tone]

  return (
    <div className={`rounded-lg border border-l-4 border-slate-200 bg-slate-50 px-3 py-2 ${border}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-navy-900">{value}</p>
    </div>
  )
}
