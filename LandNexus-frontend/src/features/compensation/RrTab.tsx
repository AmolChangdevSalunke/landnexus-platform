import { useMemo, useState, type FormEvent } from 'react'
import { Check, PlusCircle, UserPlus } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { getCaseParcels } from '../../api/acquisition'
import {
  addEntitlement,
  approveRrCase,
  completeRrCase,
  deliverEntitlement,
  getBenefitTypes,
  getRrCases,
  identifyRrCase,
} from '../../api/compensation'
import { toApiErrorInfo } from '../../api/errors'
import type {
  BenefitTypeResponse,
  CaseParcel,
  CaseResponse,
  RrCaseRequest,
  RrCaseResponse,
  RrEntitlementResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDate, formatMoney, formatPercent, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { todayIso } from '../acquisition/dates'
import {
  RR_BENEFIT_KIND_LABELS,
  RR_CASE_STATUS_LABELS,
  RR_CASE_STATUS_VARIANTS,
} from './labels'
import { LandownerName } from './LandownerName'

interface OwnerOption {
  landownerId: string
  sharePercent: number
}

function uniqueOwners(parcels: CaseParcel[]): OwnerOption[] {
  const seen = new Map<string, number>()
  parcels.forEach((parcel) => {
    parcel.owners.forEach((owner) => {
      seen.set(owner.landownerId, (seen.get(owner.landownerId) ?? 0) + owner.sharePercent)
    })
  })
  return Array.from(seen.entries()).map(([landownerId, sharePercent]) => ({
    landownerId,
    sharePercent,
  }))
}

export function RrTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const { can } = useAuth()
  const canManage = can(PERMISSION.RR_MANAGE)
  const canReadLandowners = can(PERMISSION.LANDOWNER_READ)
  const [reloadTick, setReloadTick] = useState(0)
  const [identifyOpen, setIdentifyOpen] = useState(false)

  const rrQuery = useApiQuery(
    () => getRrCases(acquisitionCase.id),
    [acquisitionCase.id, reloadKey, reloadTick],
  )
  const parcelsQuery = useApiQuery(
    () => getCaseParcels(acquisitionCase.id),
    [acquisitionCase.id, reloadKey, reloadTick],
    canManage,
  )

  const families = rrQuery.data ?? []
  const owners = useMemo(
    () => uniqueOwners(parcelsQuery.data ?? []),
    [parcelsQuery.data],
  )
  const identified = new Set(families.map((family) => family.landownerId))
  const availableOwners = owners.filter((owner) => !identified.has(owner.landownerId))

  function reload() {
    setReloadTick((current) => current + 1)
  }

  return (
    <div className="space-y-4">
      <Alert variant="info" title="Rehabilitation and resettlement is family based">
        This tab records only the simple facts needed to check a benefit condition: whether the
        family lost their home and whether they lost their livelihood. There is no field for
        caste, religion or any other sensitive attribute. Entitlements come from the catalogue
        approved by the administering authority.
      </Alert>

      {canReadLandowners ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Personal data: every view of a family name is recorded in the audit trail. Names are
          revealed only when you ask for them.
        </p>
      ) : null}

      <Card className="p-4">
        <CardHeader
          title="Families in this case"
          description="The backend checks that a family is an owner in this acquisition case."
          action={
            canManage ? (
              <Button
                onClick={() => setIdentifyOpen(true)}
                disabled={owners.length === 0}
                leftIcon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
              >
                Identify family
              </Button>
            ) : null
          }
        />

        {rrQuery.error ? (
          <ErrorState
            title="Could not load the R&R families"
            message={rrQuery.error.message}
            onRetry={rrQuery.reload}
          />
        ) : rrQuery.isLoading ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : families.length === 0 ? (
          <EmptyState
            title="No family identified yet"
            description={
              canManage
                ? 'Identify a family to record whether they lost their home or their livelihood.'
                : 'An R&R officer identifies the affected families.'
            }
          />
        ) : (
          <div className="mt-4 space-y-4">
            {families.map((family) => (
              <RrFamilyCard
                key={family.id}
                rrCase={family}
                canManage={canManage}
                canReadLandowners={canReadLandowners}
                onChanged={reload}
              />
            ))}
          </div>
        )}

        {canManage && owners.length === 0 && !parcelsQuery.isLoading ? (
          <p className="mt-3 text-xs text-slate-500">
            Add an owner to an affected parcel first. The R&R family must be an owner in this
            case.
          </p>
        ) : null}
      </Card>

      {identifyOpen ? (
        <IdentifyFamilyDialog
          caseId={acquisitionCase.id}
          owners={availableOwners}
          onClose={() => setIdentifyOpen(false)}
          onSaved={() => {
            setIdentifyOpen(false)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function RrFamilyCard({
  rrCase,
  canManage,
  canReadLandowners,
  onChanged,
}: {
  rrCase: RrCaseResponse
  canManage: boolean
  canReadLandowners: boolean
  onChanged: () => void
}) {
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const [benefitOpen, setBenefitOpen] = useState(false)
  const [deliverTarget, setDeliverTarget] = useState<RrEntitlementResponse | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const completeMutation = useApiMutation<RrCaseResponse>()

  const actions = new Set(rrCase.availableActions)
  const isMaker = rrCase.createdByUserId === user?.id

  async function approve() {
    if (isApproving) {
      return
    }
    setIsApproving(true)
    setActionError(null)
    try {
      await approveRrCase(rrCase.id)
      dispatch(addToast({ variant: 'success', message: 'R&R case approved.' }))
      onChanged()
    } catch (caught) {
      setActionError(toApiErrorInfo(caught).message)
    } finally {
      setIsApproving(false)
    }
  }

  async function complete() {
    if (completeMutation.isLoading) {
      return
    }
    try {
      await completeMutation.mutate(() => completeRrCase(rrCase.id))
      dispatch(addToast({ variant: 'success', message: 'R&R case completed.' }))
      setCompleteOpen(false)
      onChanged()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  const columns: TableColumn<RrEntitlementResponse>[] = [
    {
      key: 'benefit',
      header: 'Benefit',
      render: (entitlement) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-900">{entitlement.benefitName}</p>
          <p className="font-mono text-[10px] text-slate-500">{entitlement.benefitCode}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (entitlement) => RR_BENEFIT_KIND_LABELS[entitlement.kind],
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (entitlement) =>
        entitlement.amount === null ? '—' : formatMoney(entitlement.amount),
    },
    {
      key: 'months',
      header: 'Months',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (entitlement) => entitlement.months ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (entitlement) => (
        <div className="space-y-1">
          <Badge variant={entitlement.status === 'DELIVERED' ? 'success' : 'neutral'}>
            {entitlement.status === 'DELIVERED' ? 'Delivered' : 'Planned'}
          </Badge>
          {entitlement.deliveredOn ? (
            <p className="text-xs text-slate-500">{formatDate(entitlement.deliveredOn)}</p>
          ) : null}
        </div>
      ),
    },
  ]

  if (canManage && actions.has('DELIVER')) {
    columns.push({
      key: 'actions',
      header: 'Action',
      render: (entitlement) =>
        entitlement.status === 'PLANNED' ? (
          <Button size="sm" variant="outline" onClick={() => setDeliverTarget(entitlement)}>
            Mark delivered
          </Button>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        ),
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-navy-900">Family</h3>
            <LandownerName
              landownerId={rrCase.landownerId}
              canReadLandowners={canReadLandowners}
              hiddenLabel="Beneficiary (hidden)"
            />
            <Badge variant={RR_CASE_STATUS_VARIANTS[rrCase.status]}>
              {RR_CASE_STATUS_LABELS[rrCase.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {rrCase.displaced ? 'Lost their home' : 'Home not lost'}
            {' · '}
            {rrCase.livelihoodLost ? 'Lost their livelihood' : 'Livelihood not lost'}
          </p>
          {rrCase.notes ? (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {rrCase.notes}
            </p>
          ) : null}
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span>Identified by user</span>
            <span className="font-mono" title={rrCase.createdByUserId}>
              {shortId(rrCase.createdByUserId)}
            </span>
            {rrCase.decidedAt ? <span>· decided {formatDate(rrCase.decidedAt)}</span> : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <LinkButton to={`/compensation/rr-cases/${rrCase.id}`} variant="ghost" size="sm">
            Open full record
          </LinkButton>
          {canManage && actions.has('ADD_ENTITLEMENT') ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBenefitOpen(true)}
              leftIcon={<PlusCircle aria-hidden="true" className="h-3.5 w-3.5" />}
            >
              Add benefit
            </Button>
          ) : null}
          {canManage && actions.has('APPROVE') ? (
            isMaker ? (
              <span className="text-xs text-slate-500" title="Maker-checker rule">
                You identified this family
              </span>
            ) : (
              <Button
                size="sm"
                isLoading={isApproving}
                onClick={() => void approve()}
                leftIcon={<Check aria-hidden="true" className="h-3.5 w-3.5" />}
              >
                Approve
              </Button>
            )
          ) : null}
          {canManage && actions.has('COMPLETE') ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                completeMutation.reset()
                setCompleteOpen(true)
              }}
            >
              Complete
            </Button>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <div className="px-4 pt-3">
          <Alert variant="error" title="The action was not completed">
            {actionError}
          </Alert>
        </div>
      ) : null}

      <div className="p-4">
        <DataTable
          columns={columns}
          rows={rrCase.entitlements}
          rowKey={(entitlement) => entitlement.id}
          caption={`Entitlements for this R&R family`}
          emptyTitle="No entitlement recorded"
          emptyDescription={
            canManage && actions.has('ADD_ENTITLEMENT')
              ? 'Add a benefit from the catalogue.'
              : 'Benefits appear here after an R&R officer adds them.'
          }
        />
        {rrCase.entitlements.some((entitlement) => entitlement.deliveryRemarks) ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {rrCase.entitlements
              .filter((entitlement) => entitlement.deliveryRemarks)
              .map((entitlement) => (
                <li key={entitlement.id}>
                  <span className="font-medium text-slate-700">{entitlement.benefitName}:</span>{' '}
                  {entitlement.deliveryRemarks}
                </li>
              ))}
          </ul>
        ) : null}
      </div>

      {benefitOpen ? (
        <AddBenefitDialog
          rrCase={rrCase}
          onClose={() => setBenefitOpen(false)}
          onSaved={() => {
            setBenefitOpen(false)
            onChanged()
          }}
        />
      ) : null}

      {deliverTarget ? (
        <DeliverBenefitDialog
          rrCaseId={rrCase.id}
          entitlement={deliverTarget}
          onClose={() => setDeliverTarget(null)}
          onSaved={() => {
            setDeliverTarget(null)
            onChanged()
          }}
        />
      ) : null}

      {completeOpen ? (
        <ConfirmDialog
          title="Complete this R&R case?"
          message="Every benefit must be delivered first. The server checks the entitlements and rejects the request if any benefit is still planned."
          confirmLabel="Complete case"
          isLoading={completeMutation.isLoading}
          onConfirm={() => void complete()}
          onClose={() => setCompleteOpen(false)}
        />
      ) : null}
    </div>
  )
}

function IdentifyFamilyDialog({
  caseId,
  owners,
  onClose,
  onSaved,
}: {
  caseId: string
  owners: OwnerOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<RrCaseResponse>()
  const [landownerId, setLandownerId] = useState(owners[0]?.landownerId ?? '')
  const [displaced, setDisplaced] = useState(false)
  const [livelihoodLost, setLivelihoodLost] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }
    if (!landownerId) {
      setError('Select the owner who belongs to this family.')
      return
    }
    setError(null)
    const request: RrCaseRequest = {
      landownerId,
      displaced,
      livelihoodLost,
      notes: notes.trim() || null,
    }
    try {
      await mutation.mutate(() => identifyRrCase(caseId, request))
      dispatch(addToast({ variant: 'success', message: 'Family identified for R&R.' }))
      onSaved()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  return (
    <Modal
      title="Identify an R&R family"
      description="Record only the two plain facts that the benefit conditions use. No sensitive attribute is collected."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="identify-family-form" isLoading={mutation.isLoading}>
            Identify family
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The family was not identified" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="identify-family-form" onSubmit={submit} noValidate className="space-y-4">
        <Select
          label="Owner in this case"
          required
          value={landownerId}
          onChange={(event) => {
            setLandownerId(event.target.value)
            setError(null)
          }}
          error={error ?? undefined}
          hint="Only owners of the affected parcels can be identified."
        >
          <option value="">Select an owner</option>
          {owners.map((owner) => (
            <option key={owner.landownerId} value={owner.landownerId}>
              Owner {shortId(owner.landownerId)} · {formatPercent(owner.sharePercent)} share
            </option>
          ))}
        </Select>

        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Facts used by benefit conditions
          </legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={displaced}
              onChange={(event) => setDisplaced(event.target.checked)}
            />
            Lost their home
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={livelihoodLost}
              onChange={(event) => setLivelihoodLost(event.target.checked)}
            />
            Lost their livelihood
          </label>
        </fieldset>

        <Textarea
          label="Notes (optional)"
          value={notes}
          rows={3}
          maxLength={1000}
          onChange={(event) => setNotes(event.target.value)}
          hint="Do not record caste, religion or any other sensitive attribute."
        />
      </form>
    </Modal>
  )
}

function AddBenefitDialog({
  rrCase,
  onClose,
  onSaved,
}: {
  rrCase: RrCaseResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<RrCaseResponse>()
  const catalogueQuery = useApiQuery(() => getBenefitTypes(), [])
  const [benefitTypeId, setBenefitTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [months, setMonths] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const benefits = (catalogueQuery.data ?? []).filter((benefit) => benefit.active)
  const selected = benefits.find((benefit) => benefit.id === benefitTypeId) ?? null
  const alreadyAdded = new Set(rrCase.entitlements.map((entitlement) => entitlement.benefitCode))

  function meetsConditions(benefit: BenefitTypeResponse): boolean {
    if (benefit.requiresDisplaced && !rrCase.displaced) {
      return false
    }
    if (benefit.requiresLivelihoodLost && !rrCase.livelihoodLost) {
      return false
    }
    return true
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }
    const nextErrors: Record<string, string> = {}
    if (!benefitTypeId) {
      nextErrors.benefitTypeId = 'Select a benefit from the catalogue.'
    }
    if (amount.trim()) {
      const parsed = Number(amount)
      if (!Number.isFinite(parsed) || parsed < 0) {
        nextErrors.amount = 'Enter an amount of zero or more.'
      }
    }
    if (months.trim()) {
      const parsed = Number(months)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
        nextErrors.months = 'Enter a whole number of months between 1 and 120.'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        addEntitlement(rrCase.id, {
          benefitTypeId,
          amount: amount.trim() ? Number(amount) : null,
          months: months.trim() ? Number(months) : null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Benefit added to the family.' }))
      onSaved()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  return (
    <Modal
      title="Add a benefit"
      description="The benefit must come from the approved catalogue. Leave the amount or months blank to use the catalogue default."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-benefit-form" isLoading={mutation.isLoading}>
            Add benefit
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The benefit was not added" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      {catalogueQuery.error ? (
        <ErrorState
          title="Could not load the benefit catalogue"
          message={catalogueQuery.error.message}
          onRetry={catalogueQuery.reload}
        />
      ) : null}

      <form id="add-benefit-form" onSubmit={submit} noValidate className="space-y-4">
        <Select
          label="Benefit"
          required
          value={benefitTypeId}
          onChange={(event) => {
            setBenefitTypeId(event.target.value)
            setErrors({})
          }}
          error={errors.benefitTypeId}
          disabled={catalogueQuery.isLoading}
        >
          <option value="">
            {catalogueQuery.isLoading ? 'Loading benefits…' : 'Select a benefit'}
          </option>
          {benefits.map((benefit) => {
            const blocked =
              !meetsConditions(benefit) || alreadyAdded.has(benefit.code)
            return (
              <option key={benefit.id} value={benefit.id} disabled={blocked}>
                {benefit.name} · {RR_BENEFIT_KIND_LABELS[benefit.kind]}
                {alreadyAdded.has(benefit.code) ? ' · already added' : ''}
                {!meetsConditions(benefit) ? ' · condition not met' : ''}
              </option>
            )
          })}
        </Select>

        {selected ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Catalogue default:{' '}
            {selected.defaultAmount === null ? 'no fixed amount' : formatMoney(selected.defaultAmount)}
            {selected.defaultMonths === null ? '' : ` · ${selected.defaultMonths} months`}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount (INR, optional)"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={errors.amount}
            hint="Leave blank to use the catalogue default."
          />
          <Input
            label="Months (optional)"
            inputMode="numeric"
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            error={errors.months}
            hint="Used by a monthly allowance."
          />
        </div>
      </form>
    </Modal>
  )
}

function DeliverBenefitDialog({
  rrCaseId,
  entitlement,
  onClose,
  onSaved,
}: {
  rrCaseId: string
  entitlement: RrEntitlementResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<RrCaseResponse>()
  const [deliveredOn, setDeliveredOn] = useState(todayIso())
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }
    if (!deliveredOn) {
      setError('Choose the delivery date.')
      return
    }
    setError(null)
    try {
      await mutation.mutate(() =>
        deliverEntitlement(rrCaseId, entitlement.id, {
          deliveredOn,
          remarks: remarks.trim() || null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Benefit marked as delivered.' }))
      onSaved()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  return (
    <Modal
      title="Mark this benefit delivered"
      description={`${entitlement.benefitName} · ${RR_BENEFIT_KIND_LABELS[entitlement.kind]}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="deliver-benefit-form" isLoading={mutation.isLoading}>
            Mark delivered
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The delivery was not recorded" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="deliver-benefit-form" onSubmit={submit} noValidate className="space-y-4">
        <Input
          label="Delivered on"
          required
          type="date"
          value={deliveredOn}
          max={todayIso()}
          onChange={(event) => {
            setDeliveredOn(event.target.value)
            setError(null)
          }}
          error={error ?? undefined}
          hint="The date cannot be in the future."
        />
        <Textarea
          label="Remarks (optional)"
          value={remarks}
          rows={3}
          maxLength={500}
          onChange={(event) => setRemarks(event.target.value)}
        />
      </form>
    </Modal>
  )
}
