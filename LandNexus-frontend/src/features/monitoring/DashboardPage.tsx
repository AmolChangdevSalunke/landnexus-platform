import { lazy, Suspense } from 'react'
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Gavel,
  IndianRupee,
  LandPlot,
  MapPinned,
  RefreshCw,
  Scale,
  Users,
} from 'lucide-react'
import type { Dashboard, DistrictRow } from '../../api/types'
import { getDashboard } from '../../api/monitoring'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { usePagination } from '../../hooks/usePagination'
import { POLL_INTERVAL_MS, useVisibilityPolling } from '../../hooks/useVisibilityPolling'
import { PERMISSION } from '../../utils/permissions'
import {
  formatArea,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
} from '../../utils/format'
import { NoAccessPage } from '../auth/NoAccessPage'
import { useAuth } from '../auth/useAuth'
import { KpiCard, KpiGrid } from './KpiCard'
import { MonitoringFilters, ScopeSummary } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { SimulationBanner } from './SimulationBanner'
import { StatusDistribution } from './StatusDistribution'
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_ORDER,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  amountForStatuses,
  sumStatusAmounts,
  toCountEntries,
} from './labels'
import { useMonitoringScope } from './scope'

/* Recharts is heavy, so the trend chart loads only when the dashboard shows it. */
const TrendChart = lazy(() =>
  import('./TrendChart').then((module) => ({ default: module.TrendChart })),
)

export function DashboardPage() {
  const { can } = useAuth()
  const canRead = can(PERMISSION.DASHBOARD_READ)
  const scope = useMonitoringScope()

  const { data, error, isLoading, reload } = useApiQuery(
    () => getDashboard({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
    canRead,
  )

  // Keep the overview fresh without polling when the tab is hidden.
  useVisibilityPolling(reload, POLL_INTERVAL_MS, canRead)

  if (!canRead) {
    return <NoAccessPage />
  }

  return (
    <div>
      <PageHeader
        eyebrow="NLAMS · Monitoring and MIS"
        title="Monitoring dashboard"
        description="Portfolio position across proposals, projects, land acquisition and compensation, limited to your geographic scope."
        actions={
          <>
            <Button
              variant="outline"
              onClick={reload}
              isLoading={isLoading}
              leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <LinkButton to="/monitoring/reports" variant="secondary">
              MIS reports
            </LinkButton>
          </>
        }
      />

      <MonitoringTabs />
      <MonitoringFilters scope={scope} />

      {isLoading && !data ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : data ? (
        <>
          {error ? (
            <Alert variant="error" title="Could not refresh the dashboard" className="mb-4">
              {error.message} Showing the last successful refresh.
            </Alert>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <Badge variant="info">Auto-refreshes every 30 seconds</Badge>
            <span>
              Updated at{' '}
              <span
                className="font-semibold text-slate-700"
                title={formatDateTime(data.generatedAt)}
              >
                {formatTime(data.generatedAt)}
              </span>
            </span>
          </div>

          <DashboardBody data={data} onSelectDistrict={scope.selectDistrict} />
        </>
      ) : null}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <KpiGrid>
        {Array.from({ length: 8 }, (_, index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </KpiGrid>
      <Card className="p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-64 w-full" />
      </Card>
    </div>
  )
}

function DashboardBody({
  data,
  onSelectDistrict,
}: {
  data: Dashboard
  onSelectDistrict: (districtId: string) => void
}) {
  const { finance } = data
  const estimatesTotal = finance ? sumStatusAmounts(finance.estimates) : null
  const approvedCompensation = finance
    ? amountForStatuses(finance.estimates, ['APPROVED'])
    : null
  const payments = finance?.payments ?? null
  const released = payments ? amountForStatuses(payments, ['CONFIRMED']) : null
  const rr = finance?.rrCasesByStatus ?? null
  const rrTotal = rr ? Object.values(rr).reduce((sum, value) => sum + value, 0) : null
  const rrCompleted = rr ? (rr.COMPLETED ?? 0) : null

  return (
    <>
      <ScopeSummary
        level={data.level}
        generatedAt={data.generatedAt}
        stateId={data.stateId ?? ''}
        districtId={data.districtId ?? ''}
      />

      {payments ? <SimulationBanner className="mb-5" /> : null}

      <KpiGrid>
        <KpiCard
          label="Total projects"
          value={formatNumber(data.projects.total)}
          hint="Approved projects in scope"
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <KpiCard
          label="Total proposals"
          value={formatNumber(data.proposals.total)}
          hint={`${formatNumber(data.proposals.inReview)} in review`}
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          label="Land proposed"
          value={formatArea(data.projects.estimatedLandAreaHa)}
          hint="Estimated land area of projects"
          icon={<LandPlot className="h-5 w-5" />}
          tone="teal"
        />
        <KpiCard
          label="Land acquired"
          value="Not available"
          hint="The API reports area to acquire and possessions, not acquired area."
          icon={<Scale className="h-5 w-5" />}
          tone="neutral"
          unavailable
        />
      </KpiGrid>

      <KpiGrid>
        <KpiCard
          label="Acquisition cases"
          value={formatNumber(data.acquisition.totalCases)}
          hint={`${formatNumber(data.acquisition.openCases)} open`}
          icon={<MapPinned className="h-5 w-5" />}
        />
        <KpiCard
          label="Pending approvals"
          value={formatNumber(data.proposals.awaitingDecision)}
          hint="Recommended proposals awaiting a decision"
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="warning"
        />
        <KpiCard
          label="Awards declared"
          value={formatNumber(data.acquisition.awardsDeclared)}
          hint={`${formatNumber(data.acquisition.parcelsIdentified)} parcels identified`}
          icon={<Gavel className="h-5 w-5" />}
          tone="teal"
        />
        <KpiCard
          label="Possession completed"
          value={formatNumber(data.acquisition.possessionsRecorded)}
          hint="Possession records on affected parcels"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
      </KpiGrid>

      <KpiGrid>
        <KpiCard
          label="Compensation assessed"
          value={finance ? formatMoney(estimatesTotal) : 'Restricted'}
          hint={
            finance
              ? 'Total of all estimate versions by status'
              : 'Needs the valuation permission'
          }
          icon={<IndianRupee className="h-5 w-5" />}
          tone="info"
          unavailable={!finance}
        />
        <KpiCard
          label="Compensation approved"
          value={finance ? formatMoney(approvedCompensation) : 'Restricted'}
          hint={
            finance
              ? 'Estimates with status Approved'
              : 'Needs the valuation permission'
          }
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="success"
          unavailable={!finance}
        />
        <KpiCard
          label="Compensation disbursed"
          value={payments ? formatMoney(released) : 'Restricted'}
          hint={
            payments
              ? 'Confirmed as paid — simulated'
              : 'Needs the payment permission'
          }
          icon={<Banknote className="h-5 w-5" />}
          tone="warning"
          unavailable={!payments}
        />
        <KpiCard
          label="R&R progress"
          value={
            rr ? `${formatNumber(rrCompleted)} of ${formatNumber(rrTotal)} complete` : 'Restricted'
          }
          hint={rr ? 'R&R cases by status' : 'Needs the R&R permission'}
          icon={<Users className="h-5 w-5" />}
          tone="teal"
          unavailable={!rr}
        />
      </KpiGrid>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <StatusDistribution
          title="Proposals by status"
          items={toCountEntries(
            data.proposals.byStatus,
            PROPOSAL_STATUS_ORDER,
            PROPOSAL_STATUS_LABELS,
          )}
        />
        <StatusDistribution
          title="Acquisition cases by status"
          items={toCountEntries(
            data.acquisition.casesByStatus,
            CASE_STATUS_ORDER,
            CASE_STATUS_LABELS,
          )}
        />
        <StatusDistribution
          title="Projects by status"
          items={toCountEntries(
            data.projects.byStatus,
            PROJECT_STATUS_ORDER,
            PROJECT_STATUS_LABELS,
          )}
        />
      </div>

      <Suspense
        fallback={
          <Card className="mb-5 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-64 w-full" />
          </Card>
        }
      >
        <TrendChart points={data.trend} />
      </Suspense>

      <DistrictTable rows={data.districts} onSelectDistrict={onSelectDistrict} />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-navy-900">Land and documents</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Active parcels</dt>
              <dd className="mt-1 text-lg font-semibold text-navy-900">
                {formatNumber(data.land.activeParcels)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Parcel area</dt>
              <dd className="mt-1 text-lg font-semibold text-navy-900">
                {formatArea(data.land.totalAreaHa)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">With boundary</dt>
              <dd className="mt-1 text-lg font-semibold text-navy-900">
                {formatNumber(data.land.parcelsWithBoundary)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Documents pending verification</dt>
              <dd className="mt-1 text-lg font-semibold text-navy-900">
                {formatNumber(data.land.documentsPendingVerification)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-navy-900">Data notes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>
              A case status is the stage a case is currently in. It is not a cumulative
              count of cases that have passed through a stage.
            </li>
          </ul>
        </Card>
      </div>

      <Alert variant="info" title="Not available from the current monitoring API" className="mt-5">
        <ul className="list-disc space-y-1 pl-5">
          <li>Area actually acquired (only area to acquire and possession counts are exposed).</li>
          <li>Beneficiary-wise payment summaries (the dashboard returns totals by status only).</li>
          <li>Date-range filtering (the API accepts state, district and status filters only).</li>
          <li>Project deadlines, delay flags and milestone timelines (no milestone entity exists).</li>
        </ul>
      </Alert>
    </>
  )
}

function DistrictTable({
  rows,
  onSelectDistrict,
}: {
  rows: DistrictRow[]
  onSelectDistrict: (districtId: string) => void
}) {
  const { page, size, setPage, setSize } = usePagination(10)
  const start = page * size
  const visible = rows.slice(start, start + size)

  const columns: TableColumn<DistrictRow>[] = [
    {
      key: 'district',
      header: 'District',
      render: (row) => <span className="font-medium text-navy-900">{row.district}</span>,
    },
    { key: 'state', header: 'State', render: (row) => row.state },
    {
      key: 'projects',
      header: 'Projects',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatNumber(row.projects),
    },
    {
      key: 'openCases',
      header: 'Open cases',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatNumber(row.openCases),
    },
    {
      key: 'parcels',
      header: 'Parcels',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatNumber(row.parcels),
    },
    {
      key: 'area',
      header: 'Area to acquire',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatArea(row.areaToAcquireHa),
    },
  ]

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy-900">District activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Districts with any activity inside the current scope. Select a district to narrow
            every monitoring screen.
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {formatNumber(rows.length)} districts in scope
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(row) => row.districtId}
        emptyTitle="No district activity"
        emptyDescription="No projects, cases or parcels have been recorded in this scope yet."
        caption="District activity inside the current monitoring scope"
        onRowClick={(row) => onSelectDistrict(row.districtId)}
        page={page}
        size={size}
        totalElements={rows.length}
        totalPages={Math.max(1, Math.ceil(rows.length / size))}
        onPageChange={setPage}
        onSizeChange={setSize}
      />
    </Card>
  )
}
