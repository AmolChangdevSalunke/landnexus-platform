import { useMemo } from 'react'
import { Layers, Map as MapIcon, MapPinned, RefreshCw, Scale } from 'lucide-react'
import type { DistrictRow } from '../../api/types'
import { getDashboard } from '../../api/monitoring'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { usePagination } from '../../hooks/usePagination'
import { PERMISSION } from '../../utils/permissions'
import { formatArea, formatNumber, formatPercent } from '../../utils/format'
import { useAuth } from '../auth/useAuth'
import { KpiCard, KpiGrid } from './KpiCard'
import { MonitoringFilters, ScopeSummary } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { useMonitoringScope } from './scope'

interface StateTotal {
  state: string
  districts: number
  projects: number
  openCases: number
  parcels: number
  areaToAcquireHa: number
}

const DISTRICT_LIMIT = 500

export function GeographyMonitoringPage() {
  const { can } = useAuth()
  const canRead = can(PERMISSION.DASHBOARD_READ)
  const scope = useMonitoringScope()

  const { data, error, isLoading, reload } = useApiQuery(
    () => getDashboard({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
    canRead,
  )

  const stateTotals = useMemo<StateTotal[]>(() => {
    if (!data) {
      return []
    }
    const byState = new Map<string, StateTotal>()
    for (const row of data.districts) {
      const current = byState.get(row.state) ?? {
        state: row.state,
        districts: 0,
        projects: 0,
        openCases: 0,
        parcels: 0,
        areaToAcquireHa: 0,
      }
      current.districts += 1
      current.projects += row.projects
      current.openCases += row.openCases
      current.parcels += row.parcels
      current.areaToAcquireHa += row.areaToAcquireHa
      byState.set(row.state, current)
    }
    return [...byState.values()].sort((a, b) => a.state.localeCompare(b.state))
  }, [data])

  return (
    <div>
      <PageHeader
        eyebrow="NLAMS · Monitoring and MIS"
        title="District and state monitoring"
        description="Geographic distribution of projects, cases and parcels inside your scope."
        actions={
          <Button
            variant="outline"
            onClick={reload}
            isLoading={isLoading}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <MonitoringTabs />
      <MonitoringFilters scope={scope} />

      {isLoading && !data ? (
        <Card className="p-5">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : data ? (
        <>
          <ScopeSummary
            level={data.level}
            generatedAt={data.generatedAt}
            stateId={data.stateId ?? ''}
            districtId={data.districtId ?? ''}
          />

          <KpiGrid>
            <KpiCard
              label="Districts with activity"
              value={formatNumber(data.districts.length)}
              hint="Districts returned for this scope"
              icon={<MapPinned className="h-5 w-5" />}
            />
            <KpiCard
              label="Projects"
              value={formatNumber(data.projects.total)}
              hint="Across the districts below"
              icon={<Layers className="h-5 w-5" />}
              tone="teal"
            />
            <KpiCard
              label="Open cases"
              value={formatNumber(data.acquisition.openCases)}
              hint="Not closed or cancelled"
              icon={<MapIcon className="h-5 w-5" />}
              tone="warning"
            />
            <KpiCard
              label="Area to acquire"
              value={formatArea(data.acquisition.areaToAcquireHa)}
              hint={`${formatNumber(data.acquisition.parcelsIdentified)} parcels identified`}
              icon={<Scale className="h-5 w-5" />}
              tone="success"
            />
          </KpiGrid>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-navy-900">
                Land proposed versus to acquire
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-600">Estimated land area of projects</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatArea(data.projects.estimatedLandAreaHa)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-600">Area to acquire on cases</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatArea(data.acquisition.areaToAcquireHa)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-600">Parcels identified</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.acquisition.parcelsIdentified)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-600">Parcels with a boundary</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.land.parcelsWithBoundary)} (
                    {formatPercent(data.land.boundaryCoveragePercent)})
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Area actually acquired is not exposed by the monitoring API, so the two figures
                above are not a completion percentage.
              </p>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-semibold text-navy-900">How state totals are made</h2>
              <p className="mt-2 text-sm text-slate-600">
                The dashboard returns district rows, each already limited to your geographic
                scope. The state totals below add those district rows together in the browser.
                They are a view of the same data, not a separate server calculation.
              </p>
              {data.districts.length >= DISTRICT_LIMIT ? (
                <Alert variant="warning" className="mt-3">
                  The backend returns at most {DISTRICT_LIMIT} district rows. Narrow the filter to
                  see a complete picture for one state or district.
                </Alert>
              ) : null}
            </Card>
          </div>

          <StateTable rows={stateTotals} />

          <DistrictTable rows={data.districts} onSelectDistrict={scope.selectDistrict} />
        </>
      ) : null}
    </div>
  )
}

function StateTable({ rows }: { rows: StateTotal[] }) {
  const columns: TableColumn<StateTotal>[] = [
    {
      key: 'state',
      header: 'State',
      render: (row) => <span className="font-medium text-navy-900">{row.state}</span>,
    },
    {
      key: 'districts',
      header: 'Districts',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatNumber(row.districts),
    },
    {
      key: 'projects',
      header: 'Projects',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatNumber(row.projects),
    },
    {
      key: 'cases',
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
    <Card className="mb-5 p-5">
      <h2 className="text-base font-semibold text-navy-900">State-wise totals</h2>
      <p className="mt-1 text-sm text-slate-500">
        Grouped from the district rows returned for the current scope.
      </p>
      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.state}
          emptyTitle="No state activity"
          emptyDescription="No district in this scope has any project, case or parcel yet."
          caption="State totals grouped from district rows"
        />
      </div>
    </Card>
  )
}

function DistrictTable({
  rows,
  onSelectDistrict,
}: {
  rows: DistrictRow[]
  onSelectDistrict: (districtId: string) => void
}) {
  const { page, size, setPage, setSize } = usePagination(20)
  const start = page * size

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
      <h2 className="text-base font-semibold text-navy-900">District-wise progress</h2>
      <p className="mt-1 text-sm text-slate-500">
        Select a district to narrow every monitoring screen to it.
      </p>
      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows.slice(start, start + size)}
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
      </div>
    </Card>
  )
}
