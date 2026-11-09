import { useState } from 'react'
import { Eye, EyeOff, PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  generatePayments,
  getPaymentEvents,
  getPaymentSummary,
  getPayments,
  getValuations,
  releasePayment,
  simulatePayment,
} from '../../api/compensation'
import { toApiErrorInfo, type ApiErrorInfo } from '../../api/errors'
import type {
  CaseResponse,
  PaymentAction,
  PaymentResponse,
  ValuationResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import {
  formatDateTime,
  formatMoney,
  formatPercent,
  shortId,
} from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import {
  PAYMENT_ACTION_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
} from './labels'
import { LandownerName } from './LandownerName'

export function PaymentsTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const { can } = useAuth()
  const dispatch = useAppDispatch()
  const canRelease = can(PERMISSION.PAYMENT_RELEASE)
  const canReadLandowners = can(PERMISSION.LANDOWNER_READ)
  const [reloadTick, setReloadTick] = useState(0)
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null)
  const [failureTarget, setFailureTarget] = useState<PaymentResponse | null>(null)
  const [generatingValuationId, setGeneratingValuationId] = useState<string | null>(null)
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const failureMutation = useApiMutation<PaymentResponse>()

  const paymentsQuery = useApiQuery(
    () => getPayments(acquisitionCase.id),
    [acquisitionCase.id, reloadKey, reloadTick],
  )
  const summaryQuery = useApiQuery(
    () => getPaymentSummary(acquisitionCase.id),
    [acquisitionCase.id, reloadKey, reloadTick],
  )
  const valuationsQuery = useApiQuery(
    () => getValuations(acquisitionCase.id),
    [acquisitionCase.id, reloadKey, reloadTick],
  )

  const payments = paymentsQuery.data ?? []
  const summary = summaryQuery.data
  const approvedValuations = (valuationsQuery.data ?? []).filter(
    (valuation) => valuation.status === 'APPROVED',
  )
  const valuationIdsWithPayments = new Set(payments.map((payment) => payment.valuationId))

  function reload() {
    setReloadTick((current) => current + 1)
  }

  async function generate(valuation: ValuationResponse) {
    if (generatingValuationId) {
      return
    }
    setGeneratingValuationId(valuation.id)
    setActionError(null)
    try {
      await generatePayments(valuation.id)
      dispatch(
        addToast({
          variant: 'success',
          message: 'Simulated payments generated from the approved estimate.',
        }),
      )
      reload()
    } catch (caught) {
      setActionError(toApiErrorInfo(caught).message)
    } finally {
      setGeneratingValuationId(null)
    }
  }

  async function runAction(payment: PaymentResponse, action: PaymentAction) {
    if (busyPaymentId) {
      return
    }
    if (action === 'SIMULATE_FAILED') {
      setFailureTarget(payment)
      failureMutation.reset()
      return
    }
    setBusyPaymentId(payment.id)
    setActionError(null)
    try {
      if (action === 'RELEASE' || action === 'RETRY') {
        await releasePayment(payment.id)
        dispatch(
          addToast({
            variant: 'success',
            message:
              action === 'RETRY'
                ? 'Simulated payment retried.'
                : 'Simulated payment released.',
          }),
        )
      } else {
        await simulatePayment(payment.id, 'CONFIRMED')
        dispatch(
          addToast({ variant: 'success', message: 'Simulated payment confirmed.' }),
        )
      }
      reload()
    } catch (caught) {
      setActionError(toApiErrorInfo(caught).message)
    } finally {
      setBusyPaymentId(null)
    }
  }

  const columns: TableColumn<PaymentResponse>[] = [
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      render: (payment) => (
        <LandownerName
          landownerId={payment.landownerId}
          canReadLandowners={canReadLandowners}
        />
      ),
    },
    {
      key: 'share',
      header: 'Share',
      className: 'whitespace-nowrap',
      render: (payment) => formatPercent(payment.sharePercent),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (payment) => formatMoney(payment.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment) => (
        <div className="space-y-1">
          <Badge variant={PAYMENT_STATUS_VARIANTS[payment.status]}>
            {PAYMENT_STATUS_LABELS[payment.status]}
          </Badge>
          {payment.failureReason ? (
            <p className="max-w-56 text-xs text-danger-700">{payment.failureReason}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (payment) =>
        payment.reference ? (
          <span className="font-mono text-xs text-slate-700">{payment.reference}</span>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        ),
    },
    {
      key: 'attempts',
      header: 'Attempts',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (payment) => payment.attemptCount,
    },
  ]

  if (canRelease) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      render: (payment) => (
        <div className="flex flex-wrap gap-1.5">
          {payment.availableActions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant="outline"
              isLoading={busyPaymentId === payment.id}
              onClick={() => void runAction(payment, action)}
            >
              {PAYMENT_ACTION_LABELS[action]}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setExpandedPaymentId((current) =>
                current === payment.id ? null : payment.id,
              )
            }
            leftIcon={
              expandedPaymentId === payment.id ? (
                <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <Eye aria-hidden="true" className="h-3.5 w-3.5" />
              )
            }
          >
            {expandedPaymentId === payment.id ? 'Hide history' : 'History'}
          </Button>
        </div>
      ),
    })
  } else {
    columns.push({
      key: 'history',
      header: 'History',
      render: (payment) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setExpandedPaymentId((current) =>
              current === payment.id ? null : payment.id,
            )
          }
        >
          {expandedPaymentId === payment.id ? 'Hide history' : 'Show history'}
        </Button>
      ),
    })
  }

  return (
    <div className="space-y-4">
      <Alert variant="warning" title="SIMULATED PAYMENTS: no real money is moved">
        Payments in this system are simulated for demonstration and record keeping. The real
        payment system needs official access and integration. Never enter bank account details
        here; the system does not collect or show them.
      </Alert>

      {canReadLandowners ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Personal data: every view of a beneficiary name is recorded in the audit trail. Names
          are revealed only when you ask for them.
        </p>
      ) : null}

      {actionError ? (
        <Alert variant="error" title="The payment action was not completed">
          {actionError}
        </Alert>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Payments" value={String(summary.payments)} />
          <SummaryCard label="Total (simulated)" value={formatMoney(summary.totalAmount)} />
          <SummaryCard label="Instructed" value={formatMoney(summary.instructedAmount)} />
          <SummaryCard label="Sent" value={formatMoney(summary.sentAmount)} />
          <SummaryCard label="Confirmed" value={formatMoney(summary.confirmedAmount)} />
          <SummaryCard label="Failed" value={formatMoney(summary.failedAmount)} />
        </div>
      ) : summaryQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : summaryQuery.error ? (
        <ErrorState
          title="Could not load the payment summary"
          message={summaryQuery.error.message}
          onRetry={summaryQuery.reload}
        />
      ) : null}

      {canRelease ? (
        <Card className="p-4">
          <CardHeader
            title="Generate simulated payments"
            description="One payment is created per owner, split by the ownership snapshot on the approved estimate. This can be done once per estimate."
          />
          {valuationsQuery.error ? (
            <ErrorState
              title="Could not load the approved estimates"
              message={valuationsQuery.error.message}
              onRetry={valuationsQuery.reload}
            />
          ) : valuationsQuery.isLoading ? (
            <Skeleton className="mt-3 h-16 w-full" />
          ) : approvedValuations.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              No approved estimate yet. Generate payments becomes available after the competent
              authority approves an estimate in the Valuation tab.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {approvedValuations.map((valuation) => {
                const alreadyGenerated = valuationIdsWithPayments.has(valuation.id)
                return (
                  <li
                    key={valuation.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900">
                        Parcel {shortId(valuation.parcelId)} · version {valuation.versionNo}
                      </p>
                      <p className="text-xs text-slate-500">
                        Approved estimate {formatMoney(valuation.totalAmount)} ·{' '}
                        {valuation.ruleSetName} v{valuation.ruleSetVersion}
                      </p>
                    </div>
                    {alreadyGenerated ? (
                      <Badge variant="info">Payments generated</Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => void generate(valuation)}
                        isLoading={generatingValuationId === valuation.id}
                        leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
                      >
                        Generate payments
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ) : null}

      <Card className="p-4">
        <CardHeader
          title="Simulated payments"
          description="Amounts come from the approved estimate. The browser never adds money up."
        />
        {paymentsQuery.error ? (
          <ErrorState
            title="Could not load payments"
            message={paymentsQuery.error.message}
            onRetry={paymentsQuery.reload}
          />
        ) : (
          <div className="mt-4 space-y-3">
            <DataTable
              columns={columns}
              rows={payments}
              rowKey={(payment) => payment.id}
              isLoading={paymentsQuery.isLoading}
              caption={`Simulated payments for ${acquisitionCase.caseNumber}`}
              emptyTitle="No simulated payments yet"
              emptyDescription={
                canRelease
                  ? 'Generate payments from an approved estimate above.'
                  : 'Payments appear here after the finance officer generates them.'
              }
            />
            {expandedPaymentId ? (
              <PaymentHistory paymentId={expandedPaymentId} />
            ) : null}
          </div>
        )}
      </Card>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Honest limits</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Payments are simulated. No real money moves.</li>
          <li>
            The amount is the server&apos;s approved estimate. The legal formula is whatever the
            approved rule set says.
          </li>
          <li>The system never collects, displays or stores bank account details.</li>
        </ul>
      </div>

      {failureTarget ? (
        <SimulateFailureDialog
          payment={failureTarget}
          isLoading={failureMutation.isLoading}
          error={failureMutation.error}
          onClose={() => setFailureTarget(null)}
          onConfirm={async (reason) => {
            try {
              await failureMutation.mutate(() =>
                simulatePayment(failureTarget.id, 'FAILED', reason),
              )
              dispatch(
                addToast({
                  variant: 'success',
                  message: 'Simulated payment failure recorded.',
                }),
              )
              setFailureTarget(null)
              reload()
            } catch {
              // The dialog keeps the backend message.
            }
          }}
        />
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-navy-900">{value}</p>
    </div>
  )
}

function PaymentHistory({ paymentId }: { paymentId: string }) {
  const eventsQuery = useApiQuery(() => getPaymentEvents(paymentId), [paymentId])

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-sm font-semibold text-navy-900">Payment events</h4>
      {eventsQuery.error ? (
        <ErrorState
          title="Could not load the payment events"
          message={eventsQuery.error.message}
          onRetry={eventsQuery.reload}
        />
      ) : eventsQuery.isLoading ? (
        <Skeleton className="mt-2 h-16 w-full" />
      ) : (eventsQuery.data ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No events recorded for this payment.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {(eventsQuery.data ?? []).map((event) => (
            <li key={event.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">{event.event}</p>
                <p className="text-xs text-slate-500">{formatDateTime(event.occurredAt)}</p>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                {event.fromStatus ? `${event.fromStatus} → ` : ''}
                {event.toStatus} · by {event.actorUsername}
              </p>
              {event.detail ? (
                <p className="mt-1 text-xs text-slate-500">{event.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function SimulateFailureDialog({
  payment,
  isLoading,
  error,
  onClose,
  onConfirm,
}: {
  payment: PaymentResponse
  isLoading: boolean
  error: ApiErrorInfo | null
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  return (
    <Modal
      title="Simulate a failed payment"
      description={`${formatMoney(payment.amount)} · reference ${payment.reference ?? 'not assigned yet'}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="simulate-failure-form"
            variant="danger"
            isLoading={isLoading}
          >
            Record simulated failure
          </Button>
        </>
      }
    >
      <Alert variant="warning" className="mb-4">
        This records a simulated gateway answer. No real money moves and no bank details are used.
      </Alert>

      {error ? (
        <Alert variant="error" title="The simulated failure was not recorded" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <form
        id="simulate-failure-form"
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (isLoading) {
            return
          }
          if (!reason.trim()) {
            setLocalError('A reason is required to record a simulated failure.')
            return
          }
          setLocalError(null)
          onConfirm(reason.trim())
        }}
      >
        <Textarea
          label="Reason (required)"
          value={reason}
          rows={3}
          maxLength={500}
          onChange={(event) => {
            setReason(event.target.value)
            setLocalError(null)
          }}
          error={localError ?? undefined}
          hint="For example the simulated gateway rejected the instruction."
        />
      </form>
    </Modal>
  )
}
