import {
  Banknote,
  CheckCircle2,
  Clock,
  IndianRupee,
  RefreshCw,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react'
import type { StatusAmount } from '../../api/types'
import { getDashboard } from '../../api/monitoring'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION } from '../../utils/permissions'
import { formatMoney, formatNumber } from '../../utils/format'
import { useAuth } from '../auth/useAuth'
import { KpiCard, KpiGrid } from './KpiCard'
import { MonitoringFilters, ScopeSummary } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { SimulationBanner } from './SimulationBanner'
import { StatusDistribution } from './StatusDistribution'
import {
  ESTIMATE_STATUS_LABELS,
  ESTIMATE_STATUS_ORDER,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_ORDER,
  RR_STATUS_LABELS,
  RR_STATUS_ORDER,
  amountForStatuses,
  sumStatusAmounts,
  toCountEntries,
} from './labels'
import { useMonitoringScope } from './scope'

export function CompensationMonitoringPage() {
  const { can } = useAuth()
  const canRead = can(PERMISSION.DASHBOARD_READ)
  const scope = useMonitoringScope()

  const { data, error, isLoading, reload } = useApiQuery(
    () => getDashboard({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
    canRead,
  )

  const finance = data?.finance ?? null
  const estimates = finance?.estimates ?? []
  const payments = finance?.payments ?? null

  return (
    <div>
      <PageHeader
        eyebrow="NLAMS · Monitoring and MIS"
        title="Compensation monitoring"
        description="Estimate and payment progress for compensation. All payments in this deployment are simulated."
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
            <LinkButton to="/monitoring/reports?report=COMPENSATION" variant="secondary">
              Compensation report
            </LinkButton>
          </>
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

          {payments ? <SimulationBanner className="mb-5" /> : null}

          {!finance ? (
            <Card className="p-8">
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-50 text-warning-600">
                  <ShieldAlert aria-hidden="true" className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold text-navy-900">
                  Compensation figures are restricted
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  The dashboard hides compensation data unless your role has the valuation
                  permission. No amounts are estimated or filled in here.
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Ask an administrator for VALUATION_READ (and PAYMENT_READ for payment figures).
                </p>
              </div>
            </Card>
          ) : (
            <>
              <KpiGrid>
                <KpiCard
                  label="Compensation assessed"
                  value={formatMoney(sumStatusAmounts(estimates))}
                  hint="All estimate versions by status"
                  icon={<IndianRupee className="h-5 w-5" />}
                />
                <KpiCard
                  label="Compensation approved"
                  value={formatMoney(amountForStatuses(estimates, ['APPROVED']))}
                  hint="Estimates with status Approved"
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  tone="success"
                />
                <KpiCard
                  label="Released (simulated)"
                  value={
                    payments ? formatMoney(amountForStatuses(payments, ['CONFIRMED'])) : 'Restricted'
                  }
                  hint={
                    payments
                      ? 'Payments confirmed as paid — no real money moved'
                      : 'Needs the payment permission'
                  }
                  icon={<Banknote className="h-5 w-5" />}
                  tone="teal"
                  unavailable={!payments}
                />
                <KpiCard
                  label="Pending (simulated)"
                  value={
                    payments
                      ? formatMoney(amountForStatuses(payments, ['INSTRUCTED', 'SENT']))
                      : 'Restricted'
                  }
                  hint={
                    payments
                      ? 'Instructed or sent, not yet confirmed'
                      : 'Needs the payment permission'
                  }
                  icon={<Clock className="h-5 w-5" />}
                  tone="warning"
                  unavailable={!payments}
                />
              </KpiGrid>

              <div className="mb-5 grid gap-4 lg:grid-cols-2">
                <AmountTable
                  title="Estimates by status"
                  description="ValuationStatus counts and amounts returned by the dashboard."
                  items={estimates}
                  order={ESTIMATE_STATUS_ORDER}
                  labels={ESTIMATE_STATUS_LABELS}
                  emptyLabel="No compensation estimates in this scope."
                />
                <AmountTable
                  title="Payments by status"
                  description="Simulated PaymentStatus counts and amounts. No real transfer exists."
                  items={payments ?? []}
                  order={PAYMENT_STATUS_ORDER}
                  labels={PAYMENT_STATUS_LABELS}
                  emptyLabel={
                    payments
                      ? 'No payment records in this scope.'
                      : 'Hidden: needs the payment permission.'
                  }
                />
              </div>

              {payments ? (
                <Card className="mb-5 p-5">
                  <div className="flex items-center gap-2">
                    <XCircle aria-hidden="true" className="h-5 w-5 text-slate-500" />
                    <h2 className="text-base font-semibold text-navy-900">Failed payments</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatNumber(
                      payments.find((item) => item.status === 'FAILED')?.count ?? 0,
                    )}{' '}
                    simulated payment(s) failed, with a total of{' '}
                    {formatMoney(amountForStatuses(payments, ['FAILED']))}. A failed simulation
                    does not indicate a real failed bank transfer.
                  </p>
                </Card>
              ) : null}

              {finance.rrCasesByStatus ? (
                <StatusDistribution
                  title="R&R cases by status"
                  description="Rehabilitation and resettlement cases in this scope."
                  items={toCountEntries(
                    finance.rrCasesByStatus,
                    RR_STATUS_ORDER,
                    RR_STATUS_LABELS,
                  )}
                />
              ) : (
                <Alert variant="info" className="mb-5">
                  R&amp;R case counts are hidden because your role does not have the R&amp;R read
                  permission.
                </Alert>
              )}

              <Alert
                variant="info"
                title="Beneficiary-wise summaries are not available"
                className="mt-5"
              >
                <p>
                  The dashboard returns totals by status only. The COMPENSATION report adds case,
                  district and parcel labels, but it does not expose beneficiary names or
                  individual payment rows. Open the compensation report to see the parcel-level
                  rows the API does provide.
                </p>
                <div className="mt-3">
                  <LinkButton
                    to="/monitoring/reports?report=COMPENSATION"
                    variant="outline"
                    size="sm"
                  >
                    Open compensation report
                  </LinkButton>
                </div>
              </Alert>
            </>
          )}

          <Card className="mt-5 p-5">
            <div className="flex items-center gap-2">
              <Users aria-hidden="true" className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-semibold text-navy-900">Payment mode</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {finance?.paymentMode === 'SIMULATED'
                ? 'The backend reports paymentMode = SIMULATED. This is a workflow simulation only.'
                : 'No payment mode is reported because payment data is not visible to this role.'}
            </p>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function AmountTable({
  title,
  description,
  items,
  order,
  labels,
  emptyLabel,
}: {
  title: string
  description: string
  items: StatusAmount[]
  order: string[]
  labels: Record<string, string>
  emptyLabel: string
}) {
  const byStatus = new Map(items.map((item) => [item.status, item]))
  const extra = items
    .map((item) => item.status)
    .filter((status) => !order.includes(status))
    .sort()
  const statuses = [...order, ...extra]
  const totalCount = items.reduce((sum, item) => sum + item.count, 0)
  const totalAmount = sumStatusAmounts(items)

  return (
    <Card className="p-5">
      <CardHeader title={title} description={description} />

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Count
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statuses.map((status) => {
                const row = byStatus.get(status)
                return (
                  <tr key={status}>
                    <th scope="row" className="px-3 py-2 font-medium text-slate-700">
                      {labels[status] ?? status}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {formatNumber(row?.count ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {formatMoney(row?.amount ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <th scope="row" className="px-3 py-2 font-semibold text-navy-900">
                  Total
                </th>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-navy-900">
                  {formatNumber(totalCount)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-navy-900">
                  {formatMoney(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}
