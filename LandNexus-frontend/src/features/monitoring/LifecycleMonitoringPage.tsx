import {
  Banknote,
  CheckCircle2,
  FileText,
  Gavel,
  RefreshCw,
  Route,
  Scale,
  Search,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../../api/monitoring'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION } from '../../utils/permissions'
import { formatNumber } from '../../utils/format'
import { useAuth } from '../auth/useAuth'
import { KpiCard, KpiGrid } from './KpiCard'
import { MonitoringFilters, ScopeSummary } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { SimulationBanner } from './SimulationBanner'
import { StagePipeline } from './StagePipeline'
import { StatusDistribution } from './StatusDistribution'
import {
  CASE_PIPELINE_STAGES,
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  ESTIMATE_STATUS_LABELS,
  LIFECYCLE_STAGES,
  OBJECTION_STATUS_LABELS,
  OBJECTION_STATUS_ORDER,
  PAYMENT_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_ORDER,
  RR_STATUS_LABELS,
  RR_STATUS_ORDER,
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_ORDER,
  statusLabel,
  toCountEntries,
  toneForStatus,
} from './labels'
import { useMonitoringScope } from './scope'

export function LifecycleMonitoringPage() {
  const { can } = useAuth()
  const canRead = can(PERMISSION.DASHBOARD_READ)
  const scope = useMonitoringScope()

  const { data, error, isLoading, reload } = useApiQuery(
    () => getDashboard({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
    canRead,
  )

  return (
    <div>
      <PageHeader
        eyebrow="NLAMS · Monitoring and MIS"
        title="Acquisition lifecycle"
        description="Where proposals and acquisition cases currently sit in the NLAMS lifecycle."
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

          {data.finance?.payments ? <SimulationBanner className="mb-5" /> : null}

          <KpiGrid>
            <KpiCard
              label="Proposals in review"
              value={formatNumber(data.proposals.inReview)}
              hint="Submitted or under scrutiny"
              icon={<Search className="h-5 w-5" />}
              tone="info"
            />
            <KpiCard
              label="Awaiting decision"
              value={formatNumber(data.proposals.awaitingDecision)}
              hint="Recommended proposals"
              icon={<FileText className="h-5 w-5" />}
              tone="warning"
            />
            <KpiCard
              label="Awards declared"
              value={formatNumber(data.acquisition.awardsDeclared)}
              hint="Across acquisition cases"
              icon={<Gavel className="h-5 w-5" />}
              tone="success"
            />
            <KpiCard
              label="Possessions recorded"
              value={formatNumber(data.acquisition.possessionsRecorded)}
              hint="Possession records on parcels"
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="teal"
            />
          </KpiGrid>

          <StagePipeline
            title="Acquisition cases by current stage"
            description="Each case is counted once, at the status the backend records today. This is a snapshot, not a cumulative funnel."
            stages={CASE_PIPELINE_STAGES.map((stage) => ({
              key: stage.key,
              label: stage.label,
              value: data.acquisition.casesByStatus[stage.key] ?? 0,
            }))}
          />

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <StatusDistribution
              title="Proposal stages"
              description="ProposalStatus values recorded by the backend."
              items={toCountEntries(
                data.proposals.byStatus,
                PROPOSAL_STATUS_ORDER,
                PROPOSAL_STATUS_LABELS,
              )}
            />
            <StatusDistribution
              title="Acquisition case statuses"
              description="CaseStatus values, including cancelled cases."
              items={toCountEntries(
                data.acquisition.casesByStatus,
                CASE_STATUS_ORDER,
                CASE_STATUS_LABELS,
              )}
            />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <StatusDistribution
              title="Surveys by status"
              description="Field surveys recorded against case parcels."
              items={toCountEntries(
                data.acquisition.surveysByStatus,
                SURVEY_STATUS_ORDER,
                SURVEY_STATUS_LABELS,
              )}
            />
            <StatusDistribution
              title="Objections by status"
              description="Objections raised after a preliminary notification."
              items={toCountEntries(
                data.acquisition.objectionsByStatus,
                OBJECTION_STATUS_ORDER,
                OBJECTION_STATUS_LABELS,
              )}
            />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <StatusDistribution
              title="Compensation estimates"
              description={
                data.finance
                  ? 'Estimate versions by ValuationStatus.'
                  : 'Hidden: needs the valuation permission.'
              }
              items={
                data.finance
                  ? data.finance.estimates.map((item) => ({
                      key: item.status,
                      label: ESTIMATE_STATUS_LABELS[item.status] ?? statusLabel(item.status),
                      value: item.count,
                      tone: toneForStatus(item.status),
                    }))
                  : []
              }
              emptyLabel="No compensation estimates in this scope."
            />
            <StatusDistribution
              title="Payments"
              description={
                data.finance?.payments
                  ? 'Simulated payment records by PaymentStatus.'
                  : 'Hidden: needs the payment permission.'
              }
              items={
                data.finance?.payments
                  ? data.finance.payments.map((item) => ({
                      key: item.status,
                      label: PAYMENT_STATUS_LABELS[item.status] ?? statusLabel(item.status),
                      value: item.count,
                      tone: toneForStatus(item.status),
                    }))
                  : []
              }
              emptyLabel="No payment records in this scope."
            />
          </div>

          <StatusDistribution
            title="R&R cases by status"
            description={
              data.finance?.rrCasesByStatus
                ? 'Rehabilitation and resettlement cases by RrCaseStatus.'
                : 'Hidden: needs the R&R permission.'
            }
            items={
              data.finance?.rrCasesByStatus
                ? toCountEntries(
                    data.finance.rrCasesByStatus,
                    RR_STATUS_ORDER,
                    RR_STATUS_LABELS,
                  )
                : []
            }
            emptyLabel="No R&R cases in this scope."
          />

          <Card className="mt-5 p-5">
            <div className="flex items-center gap-2">
              <Route aria-hidden="true" className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-semibold text-navy-900">
                NLAMS stage to backend value mapping
              </h2>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">
                  Mapping from NLAMS lifecycle stages to backend status values
                </caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      NLAMS stage
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      What it covers
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Backend values
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {LIFECYCLE_STAGES.map((stage) => (
                    <tr key={stage.id}>
                      <th scope="row" className="px-4 py-3 font-medium text-navy-900">
                        {stage.label}
                      </th>
                      <td className="px-4 py-3 text-slate-600">{stage.description}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {[...(stage.proposalStatuses ?? []), ...(stage.caseStatuses ?? [])]
                          .map(statusLabel)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Compensation and R&amp;R are not case statuses: they are separate estimate, payment
              and R&amp;R records shown above. Proposal statuses describe the proposal entity;
              case statuses describe the acquisition case.
            </p>
          </Card>

          <Alert variant="info" title="Stage duration is not available" className="mt-5">
            The monitoring API returns counts by current status and the age of open SLA items. It
            does not expose a stage-duration report or the time a case spent in each stage. The
            timeline forecast on the{' '}
            <Link className="font-medium underline" to="/monitoring/sla">
              SLA and alerts
            </Link>{' '}
            screen uses completed-item history for open items only.
          </Alert>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <StatusDistribution
              title="Award and possession totals"
              items={[
                {
                  key: 'awards',
                  label: 'Awards declared',
                  value: data.acquisition.awardsDeclared,
                  tone: 'success',
                },
                {
                  key: 'possessions',
                  label: 'Possessions recorded',
                  value: data.acquisition.possessionsRecorded,
                  tone: 'teal',
                },
                {
                  key: 'parcels',
                  label: 'Parcels identified',
                  value: data.acquisition.parcelsIdentified,
                  tone: 'info',
                },
              ]}
            />
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Scale aria-hidden="true" className="h-5 w-5 text-slate-500" />
                <h2 className="text-base font-semibold text-navy-900">Area</h2>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-600">Estimated land proposed</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.projects.estimatedLandAreaHa)} ha
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-600">Area to acquire</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">
                    {formatNumber(data.acquisition.areaToAcquireHa)} ha
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Area actually acquired is not exposed by the API.
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Banknote aria-hidden="true" className="h-5 w-5 text-slate-500" />
                <h2 className="text-base font-semibold text-navy-900">Compensation</h2>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Estimate and payment status distributions are shown above. Payments are simulated;
                no real money has moved.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Open the{' '}
                <Link
                  className="font-medium text-blue-700 hover:underline"
                  to="/monitoring/compensation"
                >
                  Compensation
                </Link>{' '}
                screen for amounts.
              </p>
            </Card>
          </div>

          <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
            <Users aria-hidden="true" className="h-4 w-4" />
            <span>
              {formatNumber(data.acquisition.totalCases)} acquisition cases in total,{' '}
              {formatNumber(data.acquisition.openCases)} open.
            </span>
          </div>
        </>
      ) : null}
    </div>
  )
}
