import { useState, type FormEvent } from 'react'
import { Calculator, PlusCircle, Trash2 } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { getAward } from '../../api/acquisition'
import {
  addAsset,
  approveValuation,
  computeValuation,
  getAssets,
  getCompensationSummary,
  getValuations,
  rejectValuation,
  submitValuation,
  voidAsset,
} from '../../api/compensation'
import { toApiErrorInfo } from '../../api/errors'
import type {
  AssetCategory,
  AssetResponse,
  AwardLine,
  CaseResponse,
  CompensationSummary,
  ValuationAction,
  ValuationResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatArea, formatDate, formatDateTime, formatMoney, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { LAND_CLASSIFICATION_LABELS } from '../landRecords/labels'
import {
  ASSET_CATEGORY_LABELS,
  ESTIMATE_STATUS_LABELS,
  ESTIMATE_STATUS_VARIANTS,
  VALUATION_STATUS_LABELS,
  VALUATION_STATUS_VARIANTS,
} from './labels'
import { RemarksDialog } from './RemarksDialog'

function loadAward(caseId: string): Promise<AwardLine[] | null> {
  return getAward(caseId)
    .then((award) => award.lines)
    .catch((caught: unknown) => {
      if (toApiErrorInfo(caught).status === 404) {
        return null
      }
      throw caught
    })
}

export function ValuationTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const { can } = useAuth()
  const canManage = can(PERMISSION.VALUATION_MANAGE)
  const [reloadTick, setReloadTick] = useState(0)

  const awardQuery = useApiQuery<AwardLine[] | null>(
    () => loadAward(acquisitionCase.id),
    [acquisitionCase.id, reloadKey, reloadTick],
  )
  const valuationsQuery = useApiQuery(
    () => getValuations(acquisitionCase.id),
    [acquisitionCase.id, reloadKey, reloadTick],
  )
  const summaryQuery = useApiQuery<CompensationSummary | null>(
    () =>
      getCompensationSummary(acquisitionCase.id).catch((caught: unknown) => {
        if (toApiErrorInfo(caught).status === 404) {
          return null
        }
        throw caught
      }),
    [acquisitionCase.id, reloadKey, reloadTick],
  )

  function reload() {
    setReloadTick((current) => current + 1)
  }

  const awardLines = awardQuery.data
  const valuations = valuationsQuery.data ?? []
  const summary = summaryQuery.data

  return (
    <div className="space-y-4">
      <Alert variant="info" title="The formula is whatever the approved rule set says">
        Amounts come only from approved rate cards and approved rule sets. The backend calculates
        every line and the total; this page never adds money up in the browser.
      </Alert>

      {summary ? (
        <Card className="p-4">
          <CardHeader
            title="Compensation summary"
            description="Counts and the approved total come from the backend."
          />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <SummaryItem label="Parcels" value={summary.parcels} />
            <SummaryItem label="Approved" value={summary.approved} />
            <SummaryItem label="Submitted" value={summary.submitted} />
            <SummaryItem label="Draft" value={summary.draft} />
            <SummaryItem label="Not estimated" value={summary.notEstimated} />
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Approved total
              </dt>
              <dd className="mt-1 font-semibold text-navy-900">
                {formatMoney(summary.approvedTotal)}
              </dd>
            </div>
          </dl>
          {summary.rows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">Estimate status per awarded parcel</caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Parcel
                    </th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Awarded area
                    </th>
                    <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estimate
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.rows.map((row) => (
                    <tr key={row.caseParcelId}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700" title={row.parcelId}>
                        {shortId(row.parcelId)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{formatArea(row.awardedAreaHa)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={ESTIMATE_STATUS_VARIANTS[row.estimateStatus]}>
                          {ESTIMATE_STATUS_LABELS[row.estimateStatus]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {formatMoney(row.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : null}

      {awardQuery.isLoading || valuationsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : awardQuery.error ? (
        <ErrorState
          title="Could not load the award"
          message={awardQuery.error.message}
          onRetry={awardQuery.reload}
        />
      ) : !awardLines || awardLines.length === 0 ? (
        <EmptyState
          title="No award declared yet"
          description="An estimate can be calculated only after the award is declared for this case."
        />
      ) : (
        <div className="space-y-4">
          {awardLines.map((line) => (
            <ParcelValuationCard
              key={line.caseParcelId}
              acquisitionCase={acquisitionCase}
              awardLine={line}
              valuations={valuations.filter(
                (valuation) => valuation.caseParcelId === line.caseParcelId,
              )}
              canManage={canManage}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-bold text-navy-900">{value}</dd>
    </div>
  )
}

function ParcelValuationCard({
  acquisitionCase,
  awardLine,
  valuations,
  canManage,
  onChanged,
}: {
  acquisitionCase: CaseResponse
  awardLine: AwardLine
  valuations: ValuationResponse[]
  canManage: boolean
  onChanged: () => void
}) {
  const dispatch = useAppDispatch()
  const [assetFormOpen, setAssetFormOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<AssetResponse | null>(null)
  const [decision, setDecision] = useState<{
    valuation: ValuationResponse
    action: 'approve' | 'reject'
  } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationError, setCalculationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const assetsQuery = useApiQuery(
    () => getAssets(acquisitionCase.id, awardLine.caseParcelId),
    [acquisitionCase.id, awardLine.caseParcelId],
  )

  const live = pickLiveValuation(valuations)
  const history = valuations
    .filter((valuation) => valuation.id !== live?.id)
    .slice()
    .sort((a, b) => b.versionNo - a.versionNo)
  const assets = assetsQuery.data ?? []
  const assetsEditable = canManage && (!live || live.status === 'DRAFT')

  async function calculate() {
    if (isCalculating) {
      return
    }
    setIsCalculating(true)
    setCalculationError(null)
    try {
      await computeValuation(acquisitionCase.id, awardLine.caseParcelId)
      dispatch(addToast({ variant: 'success', message: 'Estimate calculated by the backend.' }))
      onChanged()
    } catch (caught) {
      setCalculationError(toApiErrorInfo(caught).message)
    } finally {
      setIsCalculating(false)
    }
  }

  async function runAction(valuation: ValuationResponse, action: ValuationAction) {
    if (action === 'APPROVE' || action === 'REJECT' || action === 'RECALCULATE') {
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      if (action === 'SUBMIT') {
        await submitValuation(valuation.id)
        dispatch(addToast({ variant: 'success', message: 'Estimate submitted for approval.' }))
        onChanged()
      }
    } catch (caught) {
      setSubmitError(toApiErrorInfo(caught).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const assetColumns: TableColumn<AssetResponse>[] = [
    {
      key: 'category',
      header: 'Category',
      render: (asset) => ASSET_CATEGORY_LABELS[asset.category],
    },
    { key: 'description', header: 'Description', render: (asset) => asset.description },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (asset) => `${asset.quantity} ${asset.unit}`,
    },
    {
      key: 'unitValue',
      header: 'Unit value',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (asset) => formatMoney(asset.unitValue),
    },
    {
      key: 'value',
      header: 'Value',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (asset) => formatMoney(asset.value),
    },
    {
      key: 'status',
      header: 'Status',
      render: (asset) =>
        asset.voided ? (
          <div>
            <Badge variant="danger">Voided</Badge>
            {asset.voidReason ? (
              <p className="mt-1 max-w-48 text-xs text-slate-500">{asset.voidReason}</p>
            ) : null}
          </div>
        ) : (
          <Badge variant="success">Recorded</Badge>
        ),
    },
  ]

  if (canManage) {
    assetColumns.push({
      key: 'actions',
      header: 'Action',
      render: (asset) =>
        assetsEditable && !asset.voided ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVoidTarget(asset)}
            leftIcon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
          >
            Void
          </Button>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        ),
    })
  }

  return (
    <Card className="p-4">
      <CardHeader
        title={
          <span>
            Parcel{' '}
            <span className="font-mono text-sm" title={awardLine.parcelId}>
              {shortId(awardLine.parcelId)}
            </span>
          </span>
        }
        description={`Awarded area ${formatArea(awardLine.awardedAreaHa)} · the award line is the basis of the estimate.`}
        action={
          canManage ? (
            <Button
              onClick={() => void calculate()}
              isLoading={isCalculating}
              leftIcon={<Calculator aria-hidden="true" className="h-4 w-4" />}
            >
              {live ? 'Recalculate estimate' : 'Calculate estimate'}
            </Button>
          ) : null
        }
      />

      {calculationError ? (
        <Alert variant="error" title="The estimate was not calculated" className="mt-3">
          {calculationError}
        </Alert>
      ) : null}
      {submitError ? (
        <Alert variant="error" title="The action was not completed" className="mt-3">
          {submitError}
        </Alert>
      ) : null}

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-navy-900">Assets recorded on the parcel</h3>
          {canManage && assetsEditable ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAssetFormOpen(true)}
              leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
            >
              Add asset
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Assets can be added or voided only while the estimate is a draft.
        </p>

        {assetsQuery.error ? (
          <ErrorState
            title="Could not load assets"
            message={assetsQuery.error.message}
            onRetry={assetsQuery.reload}
          />
        ) : (
          <div className="mt-3">
            <DataTable
              columns={assetColumns}
              rows={assets}
              rowKey={(asset) => asset.id}
              isLoading={assetsQuery.isLoading}
              caption={`Assets for parcel ${awardLine.parcelId}`}
              emptyTitle="No assets recorded"
              emptyDescription="Buildings, trees, wells and crops are recorded here when they affect the estimate."
            />
          </div>
        )}
      </div>

      {live ? (
        <ValuationCard
          valuation={live}
          canManage={canManage}
          isSubmitting={isSubmitting}
          onAction={(action) => {
            if (action === 'APPROVE' || action === 'REJECT') {
              setDecision({ valuation: live, action: action === 'APPROVE' ? 'approve' : 'reject' })
            } else {
              void runAction(live, action)
            }
          }}
        />
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-navy-900">No estimate yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {canManage
              ? 'Use Calculate estimate when an approved rate and rule set apply.'
              : 'An authorised officer calculates the estimate.'}
          </p>
        </div>
      )}

      {history.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-navy-900">Earlier versions</h3>
          <ul className="mt-2 space-y-2">
            {history.map((valuation) => (
              <li
                key={valuation.id}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 opacity-75"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-700">
                    v{valuation.versionNo} · {formatMoney(valuation.totalAmount)} ·{' '}
                    {formatDate(valuation.referenceDate)}
                  </p>
                  <Badge variant={VALUATION_STATUS_VARIANTS[valuation.status]}>
                    {VALUATION_STATUS_LABELS[valuation.status]}
                  </Badge>
                </div>
                {valuation.decisionRemarks ? (
                  <p className="mt-1 text-xs text-slate-500">{valuation.decisionRemarks}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assetFormOpen ? (
        <AddAssetDialog
          caseId={acquisitionCase.id}
          caseParcelId={awardLine.caseParcelId}
          onClose={() => setAssetFormOpen(false)}
          onSaved={() => {
            setAssetFormOpen(false)
            assetsQuery.reload()
            onChanged()
          }}
        />
      ) : null}

      {voidTarget ? (
        <VoidAssetDialog
          caseId={acquisitionCase.id}
          asset={voidTarget}
          onClose={() => setVoidTarget(null)}
          onSaved={() => {
            setVoidTarget(null)
            assetsQuery.reload()
            onChanged()
          }}
        />
      ) : null}

      {decision ? (
        <ValuationDecisionDialog
          valuation={decision.valuation}
          action={decision.action}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null)
            onChanged()
          }}
        />
      ) : null}
    </Card>
  )
}

function pickLiveValuation(valuations: ValuationResponse[]): ValuationResponse | null {
  const liveStatuses = new Set(['DRAFT', 'SUBMITTED', 'APPROVED'])
  return (
    valuations
      .filter((valuation) => liveStatuses.has(valuation.status))
      .slice()
      .sort((a, b) => b.versionNo - a.versionNo)[0] ?? null
  )
}

function ValuationCard({
  valuation,
  canManage,
  isSubmitting,
  onAction,
}: {
  valuation: ValuationResponse
  canManage: boolean
  isSubmitting: boolean
  onAction: (action: ValuationAction) => void
}) {
  const actions = canManage ? valuation.availableActions : []

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-navy-900">
              Estimate version {valuation.versionNo}
            </h3>
            <Badge variant={VALUATION_STATUS_VARIANTS[valuation.status]}>
              {VALUATION_STATUS_LABELS[valuation.status]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {valuation.ruleSetName} v{valuation.ruleSetVersion} · reference date{' '}
            {formatDate(valuation.referenceDate)} · prepared by{' '}
            {valuation.preparedByUsername}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Area {formatArea(valuation.awardedAreaHa)} ·{' '}
            {LAND_CLASSIFICATION_LABELS[valuation.classification]} · rate{' '}
            {formatMoney(valuation.ratePerHa)} per hectare
          </p>
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant={action === 'REJECT' ? 'outline' : action === 'APPROVE' ? 'primary' : 'outline'}
                isLoading={action === 'SUBMIT' && isSubmitting}
                onClick={() => onAction(action)}
              >
                {action === 'SUBMIT'
                  ? 'Submit for approval'
                  : action === 'RECALCULATE'
                    ? 'Recalculate'
                    : action === 'APPROVE'
                      ? 'Approve'
                      : 'Reject'}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto p-4">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <caption className="sr-only">
            Line-by-line compensation breakdown for estimate version {valuation.versionNo}
          </caption>
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Component
              </th>
              <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                How it was calculated
              </th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {valuation.lines.map((line) => (
              <tr key={`${line.position}-${line.code}`}>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-800">{line.name}</p>
                  <p className="font-mono text-[10px] text-slate-500">{line.code}</p>
                </td>
                <td className="px-3 py-2 text-slate-600">{line.basis}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-800">
                  {formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <th scope="row" colSpan={2} className="px-3 py-2 text-right text-sm font-semibold text-navy-900">
                Total (calculated by the server)
              </th>
              <td className="whitespace-nowrap px-3 py-2 text-right text-base font-bold text-navy-900">
                {formatMoney(valuation.totalAmount)}
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={2} className="px-3 py-1 text-right text-xs text-slate-500">
                Asset total included
              </th>
              <td className="px-3 py-1 text-right text-xs text-slate-500">
                {formatMoney(valuation.assetTotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {valuation.decisionRemarks ? (
          <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Decision remarks: {valuation.decisionRemarks}
            {valuation.decidedAt ? ` · ${formatDateTime(valuation.decidedAt)}` : ''}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function AddAssetDialog({
  caseId,
  caseParcelId,
  onClose,
  onSaved,
}: {
  caseId: string
  caseParcelId: string
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<AssetResponse>()
  const [category, setCategory] = useState<AssetCategory | ''>('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [unitValue, setUnitValue] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }
    const nextErrors: Record<string, string> = {}
    if (!category) {
      nextErrors.category = 'Select a category.'
    }
    if (!description.trim()) {
      nextErrors.description = 'Describe the asset.'
    }
    const parsedQuantity = Number(quantity)
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      nextErrors.quantity = 'Enter a quantity greater than zero.'
    }
    if (!unit.trim()) {
      nextErrors.unit = 'Enter the unit (for example number, square metre).'
    }
    const parsedValue = Number(unitValue)
    if (!unitValue.trim() || !Number.isFinite(parsedValue) || parsedValue < 0) {
      nextErrors.unitValue = 'Enter a unit value of zero or more.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        addAsset(caseId, caseParcelId, {
          category: category as AssetCategory,
          description: description.trim(),
          quantity: parsedQuantity,
          unit: unit.trim(),
          unitValue: parsedValue,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Asset recorded.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="Add an asset"
      description="Record an asset that affects the compensation estimate. Values are entered by the officer, not calculated here."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-asset-form" isLoading={mutation.isLoading}>
            Save asset
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The asset was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="add-asset-form" onSubmit={submit} noValidate className="space-y-4">
        <Select
          label="Category"
          required
          value={category}
          onChange={(event) => setCategory(event.target.value as AssetCategory)}
          error={errors.category}
        >
          <option value="">Select a category</option>
          {Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          label="Description"
          required
          value={description}
          maxLength={300}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Quantity"
            required
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={errors.quantity}
          />
          <Input
            label="Unit"
            required
            value={unit}
            maxLength={30}
            onChange={(event) => setUnit(event.target.value)}
            error={errors.unit}
          />
          <Input
            label="Unit value (INR)"
            required
            inputMode="decimal"
            value={unitValue}
            onChange={(event) => setUnitValue(event.target.value)}
            error={errors.unitValue}
          />
        </div>
      </form>
    </Modal>
  )
}

function VoidAssetDialog({
  caseId,
  asset,
  onClose,
  onSaved,
}: {
  caseId: string
  asset: AssetResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<AssetResponse>()
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }
    if (!reason.trim()) {
      setLocalError('A reason is required to void an asset.')
      return
    }
    setLocalError(null)
    try {
      await mutation.mutate(() => voidAsset(caseId, asset.id, reason.trim()))
      dispatch(addToast({ variant: 'success', message: 'Asset voided.' }))
      onSaved()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  return (
    <Modal
      title="Void this asset?"
      description={asset.description}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="void-asset-form"
            variant="danger"
            isLoading={mutation.isLoading}
          >
            Void asset
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The asset was not voided" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}
      <form id="void-asset-form" onSubmit={submit} noValidate>
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
        />
      </form>
    </Modal>
  )
}

function ValuationDecisionDialog({
  valuation,
  action,
  onClose,
  onSaved,
}: {
  valuation: ValuationResponse
  action: 'approve' | 'reject'
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<ValuationResponse>()

  async function decide(remarks: string) {
    if (mutation.isLoading) {
      return
    }
    try {
      await mutation.mutate(() =>
        action === 'approve'
          ? approveValuation(valuation.id, remarks)
          : rejectValuation(valuation.id, remarks),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: action === 'approve' ? 'Estimate approved.' : 'Estimate rejected.',
        }),
      )
      onSaved()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  return (
    <RemarksDialog
      title={action === 'approve' ? 'Approve this estimate?' : 'Reject this estimate?'}
      description={`Version ${valuation.versionNo} · ${formatMoney(valuation.totalAmount)} · ${valuation.ruleSetName} v${valuation.ruleSetVersion}`}
      confirmLabel={action === 'approve' ? 'Approve estimate' : 'Reject estimate'}
      confirmVariant={action === 'approve' ? 'primary' : 'danger'}
      requireRemarks={action === 'reject'}
      isLoading={mutation.isLoading}
      error={mutation.error}
      onConfirm={(remarks) => void decide(remarks)}
      onClose={onClose}
    />
  )
}
