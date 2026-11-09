import { useEffect, useState, type FormEvent } from 'react'
import { Check, PlusCircle, X } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { approveRate, createRate, getRates, rejectRate } from '../../api/compensation'
import type { ApiErrorInfo } from '../../api/errors'
import type { LandClassification, RateResponse, RateStatus } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { usePagination } from '../../hooks/usePagination'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, formatMoney, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { todayIso } from '../acquisition/dates'
import {
  LAND_CLASSIFICATION_LABELS,
} from '../landRecords/labels'
import { RATE_STATUS_LABELS, RATE_STATUS_VARIANTS } from './labels'
import { RemarksDialog } from './RemarksDialog'

const CLASSIFICATION_OPTIONS = Object.entries(LAND_CLASSIFICATION_LABELS) as [
  LandClassification,
  string,
][]

export function RateCardsTab() {
  const { can, user } = useAuth()
  const refs = useReferenceNames()
  const pagination = usePagination()
  const [status, setStatus] = useState<RateStatus | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [decision, setDecision] = useState<{
    rate: RateResponse
    action: 'approve' | 'reject'
  } | null>(null)

  const query = useApiQuery(
    () =>
      getRates({
        status: status || undefined,
        page: pagination.page,
        size: pagination.size,
      }),
    [status, pagination.page, pagination.size],
  )

  const canManage = can(PERMISSION.RATE_MANAGE)
  const canApprove = can(PERMISSION.RATE_APPROVE)
  const rates = query.data?.content ?? []

  const columns: TableColumn<RateResponse>[] = [
    {
      key: 'village',
      header: 'Village',
      render: (rate) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-900">
            {refs.villageName(rate.villageId) ?? `Village ${shortId(rate.villageId)}`}
          </p>
          <p className="text-xs text-slate-500" title={rate.villageId}>
            {refs.districtName(rate.districtId) ?? `District ${shortId(rate.districtId)}`}
          </p>
        </div>
      ),
    },
    {
      key: 'classification',
      header: 'Classification',
      render: (rate) => LAND_CLASSIFICATION_LABELS[rate.classification],
    },
    {
      key: 'rate',
      header: 'Rate per hectare',
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (rate) => formatMoney(rate.ratePerHa),
    },
    {
      key: 'effective',
      header: 'Effective from',
      render: (rate) => formatDate(rate.effectiveFrom),
    },
    {
      key: 'source',
      header: 'Source note',
      render: (rate) => (
        <span className="line-clamp-2 max-w-56 text-xs text-slate-600">
          {rate.sourceNote ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (rate) => (
        <div className="space-y-1">
          <Badge variant={RATE_STATUS_VARIANTS[rate.status]}>
            {RATE_STATUS_LABELS[rate.status]}
          </Badge>
          {rate.status !== 'PENDING' && rate.decisionRemarks ? (
            <p className="max-w-48 text-xs text-slate-500">{rate.decisionRemarks}</p>
          ) : null}
        </div>
      ),
    },
  ]

  if (canApprove) {
    columns.push({
      key: 'actions',
      header: 'Decision',
      render: (rate) => {
        const isMaker = rate.createdByUserId === user?.id
        if (rate.status !== 'PENDING') {
          return <span className="text-xs text-slate-500">Decided</span>
        }
        if (isMaker) {
          return (
            <span className="text-xs text-slate-500" title="Maker-checker rule">
              You entered this rate
            </span>
          )
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDecision({ rate, action: 'approve' })}
              leftIcon={<Check aria-hidden="true" className="h-3.5 w-3.5" />}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDecision({ rate, action: 'reject' })}
              leftIcon={<X aria-hidden="true" className="h-3.5 w-3.5" />}
            >
              Reject
            </Button>
          </div>
        )
      },
    })
  }

  return (
    <div className="space-y-4">
      <Alert variant="warning" title="No amount is built into the system">
        Market value rates are entered from the applicable law or notification. The backend
        approves them with a maker-checker rule: the person who entered a rate cannot approve it.
      </Alert>

      <Card className="p-4">
        <CardHeader
          title="Rate cards"
          description="Approved rates are the only source of land value for an estimate."
          action={
            canManage ? (
              <Button
                onClick={() => setFormOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                New rate
              </Button>
            ) : null
          }
        />

        <div className="mt-4 max-w-xs">
          <Select
            label="Status filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RateStatus | '')
              pagination.reset()
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>

        {query.error ? (
          <div className="mt-4">
            <ErrorState
              title="Could not load rate cards"
              message={query.error.message}
              onRetry={query.reload}
            />
          </div>
        ) : (
          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={rates}
              rowKey={(rate) => rate.id}
              isLoading={query.isLoading}
              caption="Market value rates"
              emptyTitle="No rate cards yet"
              emptyDescription={
                canManage
                  ? 'Add the first rate for a village and classification.'
                  : 'Rates appear here once an officer enters them.'
              }
              page={query.data?.page ?? pagination.page}
              size={query.data?.size ?? pagination.size}
              totalElements={query.data?.totalElements ?? 0}
              totalPages={query.data?.totalPages}
              onPageChange={pagination.setPage}
              onSizeChange={pagination.setSize}
            />
          </div>
        )}
      </Card>

      {formOpen ? (
        <NewRateDialog
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            query.reload()
          }}
        />
      ) : null}

      {decision ? (
        <RateDecisionDialog
          rate={decision.rate}
          action={decision.action}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null)
            query.reload()
          }}
        />
      ) : null}
    </div>
  )
}

function NewRateDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const refs = useReferenceNames()
  const mutation = useApiMutation<RateResponse>()
  const [districtId, setDistrictId] = useState('')
  const [villageId, setVillageId] = useState('')
  const [classification, setClassification] = useState<LandClassification | ''>('')
  const [ratePerHa, setRatePerHa] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [sourceNote, setSourceNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const villages = districtId ? refs.villagesForDistrict(districtId) : []
  const villagesLoading = districtId ? refs.isDistrictVillagesLoading(districtId) : false
  const { ensureDistrictVillages } = refs

  useEffect(() => {
    if (districtId) {
      ensureDistrictVillages(districtId).catch(() => {
        // Names fall back to identifiers; the backend still validates the village.
      })
    }
  }, [districtId, ensureDistrictVillages])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: Record<string, string> = {}
    if (!villageId) {
      nextErrors.villageId = 'Select a village.'
    }
    if (!classification) {
      nextErrors.classification = 'Select a land classification.'
    }
    const amount = Number(ratePerHa)
    if (!ratePerHa.trim() || !Number.isFinite(amount) || amount <= 0) {
      nextErrors.ratePerHa = 'Enter a rate greater than zero.'
    }
    if (!effectiveFrom) {
      nextErrors.effectiveFrom = 'Choose the date from which the rate applies.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        createRate({
          villageId,
          classification: classification as LandClassification,
          ratePerHa: amount,
          effectiveFrom,
          sourceNote: sourceNote.trim() || null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Rate recorded and sent for approval.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="New market value rate"
      description="Enter only a rate taken from the applicable law or notification. The rate stays pending until another officer approves it."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="new-rate-form" isLoading={mutation.isLoading}>
            Save rate
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The rate was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      {!refs.enabled ? (
        <Alert variant="info" className="mb-4">
          Your role cannot read administrative master data, so the village list is not available.
          Ask an administrator to enter the rate.
        </Alert>
      ) : null}

      <form id="new-rate-form" onSubmit={submit} noValidate className="space-y-4">
        <Select
          label="District"
          required
          value={districtId}
          onChange={(event) => {
            setDistrictId(event.target.value)
            setVillageId('')
          }}
          disabled={!refs.enabled}
        >
          <option value="">Select a district</option>
          {refs.districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </Select>

        <Select
          label="Village"
          required
          value={villageId}
          onChange={(event) => setVillageId(event.target.value)}
          error={errors.villageId}
          disabled={!districtId}
          hint={
            villagesLoading
              ? 'Loading villages…'
              : districtId && villages.length === 0
                ? 'No villages are available in this district.'
                : 'The rate applies to this village and classification from the chosen date.'
          }
        >
          <option value="">Select a village</option>
          {villages.map((village) => (
            <option key={village.id} value={village.id}>
              {village.name}
            </option>
          ))}
        </Select>

        <Select
          label="Land classification"
          required
          value={classification}
          onChange={(event) => setClassification(event.target.value as LandClassification)}
          error={errors.classification}
        >
          <option value="">Select a classification</option>
          {CLASSIFICATION_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Input
          label="Rate per hectare (INR)"
          required
          inputMode="decimal"
          value={ratePerHa}
          onChange={(event) => {
            setRatePerHa(event.target.value)
            setErrors((current) => ({ ...current, ratePerHa: '' }))
          }}
          error={errors.ratePerHa}
          hint="The amount is taken from the law or notification, never calculated here."
        />

        <Input
          label="Effective from"
          required
          type="date"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          error={errors.effectiveFrom}
        />

        <Input
          label="Source note"
          value={sourceNote}
          onChange={(event) => setSourceNote(event.target.value)}
          maxLength={500}
          hint="For example the notification number and date. Do not paste personal data."
        />
      </form>
    </Modal>
  )
}

function RateDecisionDialog({
  rate,
  action,
  onClose,
  onSaved,
}: {
  rate: RateResponse
  action: 'approve' | 'reject'
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<RateResponse>()
  const error: ApiErrorInfo | null = mutation.error

  async function decide(remarks: string) {
    if (mutation.isLoading) {
      return
    }
    try {
      await mutation.mutate(() =>
        action === 'approve' ? approveRate(rate.id, remarks) : rejectRate(rate.id, remarks),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: action === 'approve' ? 'Rate approved.' : 'Rate rejected.',
        }),
      )
      onSaved()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  return (
    <RemarksDialog
      title={action === 'approve' ? 'Approve this rate?' : 'Reject this rate?'}
      description={`${formatMoney(rate.ratePerHa)} per hectare · ${LAND_CLASSIFICATION_LABELS[rate.classification]}`}
      confirmLabel={action === 'approve' ? 'Approve rate' : 'Reject rate'}
      confirmVariant={action === 'approve' ? 'primary' : 'danger'}
      requireRemarks={action === 'reject'}
      isLoading={mutation.isLoading}
      error={error}
      onConfirm={(remarks) => void decide(remarks)}
      onClose={onClose}
    />
  )
}
