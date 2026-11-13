import {
  Banknote,
  ClipboardCheck,
  Gavel,
  LandPlot,
  RefreshCw,
  Route,
} from 'lucide-react'
import type { NlamsProject } from '../../api/types'
import { getNlams } from '../../api/monitoring'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useVisibilityPolling } from '../../hooks/useVisibilityPolling'
import {
  formatArea,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatTime,
} from '../../utils/format'
import { PROJECT_TYPE_LABELS } from '../proposals/labels'
import { KpiCard, KpiGrid } from './KpiCard'
import { MonitoringFilters, ScopeSummary } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { SimulationBanner } from './SimulationBanner'
import { useMonitoringScope } from './scope'

const STAGE_ORDER = [
  'Project approved',
  'Case initiated',
  'Parcels identified',
  'Notification complete',
  'Award declared',
  'Possession complete',
]

/**
 * Real-time NLAMS progress. The progress percent is computed by the backend from
 * five stored milestones; this screen only displays it. Payment amounts are
 * simulated and are labelled as such wherever they appear.
 */
export function NlamsPanel() {
  const scope = useMonitoringScope()
  const { data, error, isLoading, reload } = useApiQuery(
    () => getNlams({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
  )

  // Refresh every 30 seconds, but only while this tab is visible.
  useVisibilityPolling(reload)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="NLAMS · Real-time monitoring"
        title="NLAMS progress"
        description="Acquisition progress for every approved project, refreshed while this tab is visible."
        actions={
          <Button
            variant="outline"
            onClick={reload}
            isLoading={isLoading}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh now
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
          {error ? (
            <Alert variant="error" title="Could not refresh NLAMS progress" className="mb-4">
              {error.message} Showing the last successful refresh.
            </Alert>
          ) : null}

          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
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
            {scope.hasScope ? (
              <button
                type="button"
                onClick={scope.clearScope}
                className="font-medium text-blue-700 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <ScopeSummary
            level={data.districtId ? 'DISTRICT' : data.stateId ? 'STATE' : 'SCOPED'}
            generatedAt={data.generatedAt}
            stateId={data.stateId ?? ''}
            districtId={data.districtId ?? ''}
          />

          <SimulationBanner />

          <KpiGrid>
            <KpiCard
              label="Projects"
              value={formatNumber(data.totals.projects)}
              hint={`${formatNumber(data.totals.projectsInAcquisition)} have an acquisition case`}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <KpiCard
              label="Parcels identified"
              value={formatNumber(data.totals.parcelsIdentified)}
              hint={formatArea(data.totals.identifiedHa)}
              icon={<LandPlot className="h-5 w-5" />}
              tone="teal"
            />
            <KpiCard
              label="Awards declared"
              value={formatNumber(data.totals.parcelsAwarded)}
              hint={`${formatArea(data.totals.awardedHa)} covered by an award`}
              icon={<Gavel className="h-5 w-5" />}
              tone="warning"
            />
            <KpiCard
              label="Compensation paid (simulated)"
              value={formatMoney(data.totals.paidTotal)}
              hint="No real money moved — PFMS and DBT are not connected"
              icon={<Banknote className="h-5 w-5" />}
              tone="success"
            />
          </KpiGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="p-5">
              <CardHeader
                title="Projects by stage"
                description="Each project sits in exactly one stage."
              />
              <ul className="mt-4 space-y-2">
                {STAGE_ORDER.map((stage) => (
                  <li
                    key={stage}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 text-slate-700">
                      <Route aria-hidden="true" className="h-4 w-4 text-slate-400" />
                      {stage}
                    </span>
                    <span className="font-semibold tabular-nums text-navy-900">
                      {formatNumber(data.projectsByStage[stage] ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <CardHeader
                title="Acquisition totals"
                description="Counts and areas inside your geographic scope."
              />
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">Cases</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.totals.totalCases)} ({formatNumber(data.totals.openCases)} open)
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">Parcels notified</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.totals.parcelsNotified)} · {formatArea(data.totals.notifiedHa)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">Possession complete</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.totals.parcelsPossessed)} · {formatArea(data.totals.possessionHa)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">Compensation assessed (simulated)</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatMoney(data.totals.assessedTotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">Payment sent (simulated)</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatMoney(data.totals.sentTotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">Payment failed (simulated)</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatMoney(data.totals.failedTotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">Affected families</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.totals.affectedFamilies)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-slate-600">R&amp;R entitlements delivered</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.totals.rrDelivered)} of {formatNumber(data.totals.rrEntitlements)}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          {data.projects.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-medium text-navy-900">No projects in this scope</p>
              <p className="mt-1 text-sm text-slate-600">
                Projects appear here after a proposal is approved. Change the filters or check your
                geographic scope.
              </p>
            </Card>
          ) : (
            <Card className="p-0">
              <div className="p-5 pb-3">
                <CardHeader
                  title="Project progress"
                  description="Five equal milestones, twenty percent each: case, parcels, notification, award, possession."
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <th scope="col" className="px-4 py-2 font-semibold">Project</th>
                      <th scope="col" className="px-4 py-2 font-semibold">District</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Stage</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Progress</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Parcels</th>
                      <th scope="col" className="px-4 py-2 font-semibold">Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map((project) => (
                      <ProjectRow key={project.projectId} project={project} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <p className="text-xs text-slate-500">
            Progress is derived from stored counts only. Names, bank details and payment
            instructions are never shown here, and all payments are simulated.
          </p>
        </>
      ) : null}
    </div>
  )
}

function ProjectRow({ project }: { project: NlamsProject }) {
  return (
    <tr className="border-b border-slate-100 align-top last:border-0">
      <td className="px-4 py-3">
        <p className="font-semibold text-navy-900">{project.title}</p>
        <p className="text-xs text-slate-500">
          {project.projectCode ?? 'No code'} · {PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType}
        </p>
      </td>
      <td className="px-4 py-3 text-slate-700">{project.districtName ?? '—'}</td>
      <td className="px-4 py-3">
        <Badge variant={project.currentStage === 'Possession complete' ? 'success' : 'info'}>
          {project.currentStage}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="min-w-[140px]">
          <div
            role="progressbar"
            aria-label={`${project.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={project.progressPercent}
            aria-valuetext={`${project.progressPercent} percent`}
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${Math.max(0, Math.min(100, project.progressPercent))}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-medium text-slate-600">
            {formatPercent(project.progressPercent)}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <p>Identified {formatNumber(project.parcelsIdentified)}</p>
        <p>Notified {formatNumber(project.parcelsNotified)}</p>
        <p>Awarded {formatNumber(project.parcelsAwarded)}</p>
        <p>Possession {formatNumber(project.parcelsPossessed)}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <p>Estimate {formatArea(project.estimatedLandAreaHa)}</p>
        <p>Identified {formatArea(project.identifiedHa)}</p>
        <p>Possession {formatArea(project.possessionHa)}</p>
      </td>
    </tr>
  )
}
