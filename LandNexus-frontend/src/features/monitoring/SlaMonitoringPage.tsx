import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  BellRing,
  Clock,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import type { ForecastItem, SlaItem } from '../../api/types'
import { getEscalations, getForecast, getSlaOverview } from '../../api/monitoring'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { usePagination } from '../../hooks/usePagination'
import { PERMISSION } from '../../utils/permissions'
import {
  formatDateTime,
  formatDaysHours,
  formatNumber,
  formatPercent,
} from '../../utils/format'
import { useAuth } from '../auth/useAuth'
import { KpiCard, KpiGrid } from './KpiCard'
import { MonitoringFilters } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { useMonitoringScope } from './scope'

const LEVEL_VARIANTS: Record<string, BadgeVariant> = {
  WARNING: 'warning',
  BREACH: 'danger',
}

const RISK_VARIANTS: Record<string, BadgeVariant> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'success',
  INSUFFICIENT_DATA: 'neutral',
}

export function SlaMonitoringPage() {
  const { can } = useAuth()
  const canRead = can(PERMISSION.SLA_READ)
  const scope = useMonitoringScope()
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'WARNING' | 'BREACH'>('ALL')
  const escalationPager = usePagination(20)

  const sla = useApiQuery(
    () => getSlaOverview({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
    canRead,
  )

  const forecast = useApiQuery(
    () => getForecast({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
    canRead,
  )

  const escalations = useApiQuery(
    () =>
      getEscalations({
        stateId: scope.stateId || undefined,
        districtId: scope.districtId || undefined,
        page: escalationPager.page,
        size: escalationPager.size,
      }),
    [scope.stateId, scope.districtId, escalationPager.page, escalationPager.size],
    canRead,
  )

  function refreshAll() {
    sla.reload()
    forecast.reload()
    escalations.reload()
  }

  const visibleItems = (sla.data?.items ?? []).filter((item) =>
    levelFilter === 'ALL' ? true : item.level === levelFilter,
  )

  const atRisk = (forecast.data?.items ?? []).filter(
    (item) => item.risk === 'HIGH' || item.risk === 'MEDIUM',
  )

  return (
    <div>
      <PageHeader
        eyebrow="NLAMS · Monitoring and MIS"
        title="SLA and alerts"
        description="Open items against their SLA limits, the escalation log, and a statistical forecast of breach risk."
        actions={
          <Button
            variant="outline"
            onClick={refreshAll}
            isLoading={sla.isLoading || forecast.isLoading}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <MonitoringTabs />
      <MonitoringFilters scope={scope} />

      {!canRead ? (
        <Alert variant="error">
          SLA monitoring needs the SLA_READ permission. Ask an administrator for access.
        </Alert>
      ) : sla.isLoading && !sla.data ? (
        <Card className="p-5">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : sla.error && !sla.data ? (
        <Card>
          <ErrorState message={sla.error.message} onRetry={sla.reload} />
        </Card>
      ) : sla.data ? (
        <>
          <KpiGrid>
            <KpiCard
              label="On time"
              value={formatNumber(sla.data.onTime)}
              hint="Open items inside the warning limit"
              icon={<Clock className="h-5 w-5" />}
              tone="success"
            />
            <KpiCard
              label="Approaching deadline"
              value={formatNumber(sla.data.warning)}
              hint="Open items in the warning band"
              icon={<AlarmClock className="h-5 w-5" />}
              tone="warning"
            />
            <KpiCard
              label="Overdue"
              value={formatNumber(sla.data.breach)}
              hint="Open items past the breach limit"
              icon={<ShieldAlert className="h-5 w-5" />}
              tone="danger"
            />
            <KpiCard
              label="Items listed"
              value={formatNumber(sla.data.items.length)}
              hint={
                sla.data.itemsTruncated
                  ? 'The list is truncated; narrow the scope'
                  : 'Open items in the current scope'
              }
              icon={<BellRing className="h-5 w-5" />}
              tone="info"
            />
          </KpiGrid>

          {sla.data.itemsTruncated ? (
            <Alert variant="warning" className="mb-5">
              The backend truncated the open-item list. Narrow the state or district filter to
              see every item.
            </Alert>
          ) : null}

          <Card className="mb-5 p-5">
            <CardHeader
              title="SLA status by item type"
              description="Limits configured in the backend and the current position of open items."
            />
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">SLA status by item type</caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Item type
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      On time
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Warning
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Breach
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Warning after
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Breach after
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Responsible role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sla.data.byType.map((row) => (
                    <tr key={row.itemType}>
                      <th scope="row" className="px-3 py-2 font-medium text-navy-900">
                        {row.title}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatNumber(row.onTime)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-warning-700">
                        {formatNumber(row.warning)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-danger-700">
                        {formatNumber(row.breach)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatDaysHours(row.warnAfterHours)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatDaysHours(row.breachAfterHours)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.responsibleRole}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mb-5 p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-navy-900">Open items</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Warning and breach items in the current scope. Ages are measured from the
                  recorded start of the item.
                </p>
              </div>
              <div className="w-48">
                <Select
                  label="Level"
                  value={levelFilter}
                  onChange={(event) =>
                    setLevelFilter(event.target.value as 'ALL' | 'WARNING' | 'BREACH')
                  }
                >
                  <option value="ALL">All levels</option>
                  <option value="WARNING">Approaching deadline</option>
                  <option value="BREACH">Overdue</option>
                </Select>
              </div>
            </div>

            <ItemsTable rows={visibleItems} />
          </Card>

          <Card className="mb-5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp aria-hidden="true" className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-semibold text-navy-900">Breach risk forecast</h2>
            </div>
            <p className="text-sm text-slate-600">
              {forecast.data?.methodNote ??
                'A statistical forecast from this system’s own completed-item history. It is not machine learning.'}
            </p>
            {forecast.data?.method ? (
              <p className="mt-1 text-xs text-slate-500">Method: {forecast.data.method}</p>
            ) : null}

            {forecast.isLoading && !forecast.data ? (
              <Skeleton className="mt-4 h-24 w-full" />
            ) : forecast.error && !forecast.data ? (
              <ErrorState message={forecast.error.message} onRetry={forecast.reload} />
            ) : forecast.data ? (
              <>
                {forecast.data.itemsTruncated ? (
                  <Alert variant="warning" className="mt-3">
                    The forecast list is truncated. Narrow the scope to see every at-risk item.
                  </Alert>
                ) : null}

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <caption className="sr-only">Forecast by stage</caption>
                    <thead className="bg-slate-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Stage
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Samples
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Median
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          P90
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Open
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          At risk
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {forecast.data.stages.map((stage) => (
                        <tr key={stage.itemType}>
                          <th scope="row" className="px-3 py-2 font-medium text-navy-900">
                            {stage.title}
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {formatNumber(stage.samples)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {stage.medianHours === null
                              ? '—'
                              : formatDaysHours(stage.medianHours)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {stage.p90Hours === null ? '—' : formatDaysHours(stage.p90Hours)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {formatNumber(stage.open)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-warning-700">
                            {formatNumber(stage.atRisk)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="mt-5 text-sm font-semibold text-navy-900">
                  At-risk open items ({formatNumber(atRisk.length)})
                </h3>
                {atRisk.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    No open item is forecast to breach its limit.
                  </p>
                ) : (
                  <div className="mt-2">
                    <ForecastTable rows={atRisk} />
                  </div>
                )}

                {forecast.data.notes.length > 0 ? (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-500">
                    {forecast.data.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </Card>

          <Card className="mb-5 p-5">
            <CardHeader
              title="Escalation log"
              description="Escalations raised by the SLA scan. An escalation sends an in-app notification; it never changes a case state."
            />
            {escalations.error ? (
              <ErrorState message={escalations.error.message} onRetry={escalations.reload} />
            ) : (
              <div className="mt-4">
                <DataTable
                  columns={escalationColumns}
                  rows={escalations.data?.rows ?? []}
                  rowKey={(row) => row.id}
                  isLoading={escalations.isLoading}
                  emptyTitle="No escalations"
                  emptyDescription="No item has crossed an escalation threshold in this scope."
                  caption="SLA escalation log"
                  page={escalations.data?.page ?? escalationPager.page}
                  size={escalations.data?.size ?? escalationPager.size}
                  totalElements={escalations.data?.totalRows ?? 0}
                  totalPages={Math.max(
                    1,
                    Math.ceil(
                      (escalations.data?.totalRows ?? 0) /
                        (escalations.data?.size ?? escalationPager.size),
                    ),
                  )}
                  onPageChange={escalationPager.setPage}
                  onSizeChange={escalationPager.setSize}
                />
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-navy-900">Pending approvals</h2>
              <p className="mt-2 text-sm text-slate-600">
                Proposal decisions are not SLA item types. The dashboard reports how many
                proposals are recommended and awaiting a decision.
              </p>
              <p className="mt-2 text-sm">
                <Link className="font-medium text-blue-700 hover:underline" to="/monitoring">
                  Open the monitoring dashboard
                </Link>
              </p>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-semibold text-navy-900">Data notes</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {sla.data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
                <li>
                  A case status is a current state. The forecast uses completed-item history for
                  open items and is not a machine-learning model.
                </li>
              </ul>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

const escalationColumns: TableColumn<{
  id: string
  itemType: string
  reference: string
  level: string
  thresholdHours: number
  since: string
  responsibleRole: string
  escalateRole: string | null
  triggeredBy: string
  createdAt: string
}>[] = [
  {
    key: 'level',
    header: 'Level',
    render: (row) => (
      <Badge variant={LEVEL_VARIANTS[row.level] ?? 'neutral'}>{row.level}</Badge>
    ),
  },
  { key: 'item', header: 'Item', render: (row) => row.itemType.replace(/_/g, ' ').toLowerCase() },
  { key: 'reference', header: 'Reference', render: (row) => row.reference },
  {
    key: 'threshold',
    header: 'Threshold',
    render: (row) => formatDaysHours(row.thresholdHours),
  },
  { key: 'since', header: 'Open since', render: (row) => formatDateTime(row.since) },
  { key: 'responsible', header: 'Responsible', render: (row) => row.responsibleRole },
  {
    key: 'escalate',
    header: 'Escalated to',
    render: (row) => row.escalateRole ?? '—',
  },
  { key: 'triggered', header: 'Triggered by', render: (row) => row.triggeredBy },
  { key: 'created', header: 'Raised', render: (row) => formatDateTime(row.createdAt) },
]

function ItemsTable({ rows }: { rows: SlaItem[] }) {
  const columns: TableColumn<SlaItem>[] = [
    {
      key: 'level',
      header: 'Level',
      render: (row) => (
        <Badge variant={LEVEL_VARIANTS[row.level] ?? 'neutral'}>{row.level}</Badge>
      ),
    },
    { key: 'item', header: 'Item', render: (row) => row.title },
    { key: 'reference', header: 'Reference', render: (row) => row.reference },
    {
      key: 'age',
      header: 'Age',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatDaysHours(row.ageHours),
    },
    { key: 'since', header: 'Since', render: (row) => formatDateTime(row.since) },
    { key: 'responsible', header: 'Responsible', render: (row) => row.responsibleRole },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => `${row.itemType}:${row.entityId}`}
      emptyTitle="No open items"
      emptyDescription="No item in this scope has crossed its warning limit."
      caption="Open SLA items"
    />
  )
}

function ForecastTable({ rows }: { rows: ForecastItem[] }) {
  const columns: TableColumn<ForecastItem>[] = [
    {
      key: 'risk',
      header: 'Risk',
      render: (row) => (
        <Badge variant={RISK_VARIANTS[row.risk] ?? 'neutral'}>{row.risk.replace(/_/g, ' ')}</Badge>
      ),
    },
    { key: 'item', header: 'Item', render: (row) => row.title },
    { key: 'reference', header: 'Reference', render: (row) => row.reference },
    {
      key: 'age',
      header: 'Age',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatDaysHours(row.ageHours),
    },
    {
      key: 'probability',
      header: 'Breach probability',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) =>
        row.breachProbability === null ? '—' : formatPercent(row.breachProbability * 100),
    },
    {
      key: 'remaining',
      header: 'Expected remaining',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) =>
        row.expectedRemainingHours === null
          ? '—'
          : formatDaysHours(row.expectedRemainingHours),
    },
    { key: 'explanation', header: 'Basis', render: (row) => row.explanation },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => `${row.itemType}:${row.entityId}`}
      emptyTitle="No at-risk items"
      emptyDescription="No open item is forecast to breach its limit."
      caption="At-risk open SLA items"
    />
  )
}
