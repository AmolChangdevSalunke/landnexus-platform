import { useState, type FormEvent } from 'react'
import { PlusCircle, XCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  addOwnership,
  endOwnership,
  getLandowners,
  getOwnerships,
} from '../../api/landRecords'
import type {
  LandownerSummary,
  OwnershipBasis,
  OwnershipResponse,
  ParcelResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useDebounce } from '../../hooks/useDebounce'
import { formatDate, formatNumber } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { todayIso } from './dates'
import {
  HIDDEN_OWNER_LABEL,
  OWNERSHIP_BASIS_LABELS,
  OWNER_TYPE_LABELS,
} from './labels'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHARE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/

export function OwnersTab({ parcel }: { parcel: ParcelResponse }) {
  const { can } = useAuth()
  const [addOpen, setAddOpen] = useState(false)
  const [ending, setEnding] = useState<OwnershipResponse | null>(null)
  const query = useApiQuery(() => getOwnerships(parcel.id), [parcel.id])

  const canWrite = can(PERMISSION.LAND_RECORD_WRITE)
  const canReadLandowners = can(PERMISSION.LANDOWNER_READ)
  const canChange = canWrite && parcel.status === 'ACTIVE'
  const rows = query.data ?? []
  const totalCurrent = rows
    .filter((row) => row.current)
    .reduce((sum, row) => sum + row.sharePercent, 0)
  const remaining = Math.max(0, 100 - totalCurrent)

  const columns: TableColumn<OwnershipResponse>[] = [
    {
      key: 'owner',
      header: 'Owner',
      render: (ownership) =>
        ownership.ownerName ? (
          <div>
            <p className="font-medium text-navy-900">{ownership.ownerName}</p>
            {ownership.ownerType ? (
              <p className="text-xs text-slate-500">
                {OWNER_TYPE_LABELS[ownership.ownerType]}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-slate-600">{HIDDEN_OWNER_LABEL}</span>
        ),
    },
    {
      key: 'share',
      header: 'Share',
      render: (ownership) => (
        <span className="whitespace-nowrap font-medium">
          {formatNumber(ownership.sharePercent)}%
        </span>
      ),
    },
    {
      key: 'basis',
      header: 'Basis',
      render: (ownership) => OWNERSHIP_BASIS_LABELS[ownership.basis],
    },
    {
      key: 'from',
      header: 'From',
      render: (ownership) => (
        <span className="whitespace-nowrap">{formatDate(ownership.fromDate)}</span>
      ),
    },
    {
      key: 'to',
      header: 'To',
      render: (ownership) => (
        <span className="whitespace-nowrap">{formatDate(ownership.toDate)}</span>
      ),
    },
    {
      key: 'current',
      header: 'Current',
      render: (ownership) =>
        ownership.current ? (
          <Badge variant="success">Current</Badge>
        ) : (
          <Badge variant="neutral">Ended</Badge>
        ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (ownership) => ownership.remarks || <span className="text-slate-500">—</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (ownership) =>
        ownership.current && canChange ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEnding(ownership)}
            leftIcon={<XCircle aria-hidden="true" className="h-3.5 w-3.5" />}
          >
            End ownership
          </Button>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Ownership"
          description="Current shares must total at most 100%. Names are masked when your role cannot read landowner personal data."
          action={
            canChange ? (
              <Button
                onClick={() => setAddOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Add owner
              </Button>
            ) : canWrite ? (
              <Badge variant="warning">Parcel is inactive</Badge>
            ) : null
          }
        />

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Current total
            </dt>
            <dd className="mt-1 text-lg font-bold text-navy-900">
              {formatNumber(totalCurrent)}%
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Unallocated
            </dt>
            <dd className="mt-1 text-lg font-bold text-navy-900">
              {formatNumber(remaining)}%
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Records
            </dt>
            <dd className="mt-1 text-lg font-bold text-navy-900">{rows.length}</dd>
          </div>
        </dl>

        {!canReadLandowners ? (
          <Alert variant="info" title="Owner names are hidden for your role" className="mt-4">
            You can still see each share, basis and date. Personal data is only shown to roles with
            landowner read permission.
          </Alert>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 404
                ? 'Parcel not found'
                : 'Could not load ownership records'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(ownership) => ownership.id}
          isLoading={query.isLoading}
          caption="Ownership records of this parcel"
          emptyTitle="No ownership records yet"
          emptyDescription={
            canChange
              ? 'Add the first current owner and their share of the parcel.'
              : 'Ownership records will appear here once an officer adds them.'
          }
          emptyAction={
            canChange ? (
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                Add owner
              </Button>
            ) : undefined
          }
        />
      )}

      {addOpen ? (
        <AddOwnershipDialog
          parcel={parcel}
          remaining={remaining}
          canReadLandowners={canReadLandowners}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            query.reload()
          }}
        />
      ) : null}

      {ending ? (
        <EndOwnershipDialog
          parcel={parcel}
          ownership={ending}
          onClose={() => setEnding(null)}
          onSaved={() => {
            setEnding(null)
            query.reload()
          }}
        />
      ) : null}
    </div>
  )
}

interface AddOwnershipErrors {
  landownerId?: string
  share?: string
  basis?: string
  fromDate?: string
}

function AddOwnershipDialog({
  parcel,
  remaining,
  canReadLandowners,
  onClose,
  onSaved,
}: {
  parcel: ParcelResponse
  remaining: number
  canReadLandowners: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<OwnershipResponse>()
  const [search, setSearch] = useState('')
  const [selectedOwner, setSelectedOwner] = useState<LandownerSummary | null>(null)
  const [manualLandownerId, setManualLandownerId] = useState('')
  const [share, setShare] = useState('')
  const [basis, setBasis] = useState<OwnershipBasis | ''>('')
  const [fromDate, setFromDate] = useState(todayIso())
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<AddOwnershipErrors>({})

  const debouncedSearch = useDebounce(search.trim(), 300)
  const landownerQuery = useApiQuery(
    () =>
      canReadLandowners
        ? getLandowners({
            districtId: parcel.districtId,
            name: debouncedSearch || undefined,
            page: 0,
            size: 20,
          })
        : Promise.resolve(null),
    [canReadLandowners, parcel.districtId, debouncedSearch],
    canReadLandowners,
  )

  const landownerOptions = landownerQuery.data?.content ?? []
  const selectedIsListed =
    selectedOwner !== null &&
    landownerOptions.some((owner) => owner.id === selectedOwner.id)

  function handleOwnerSelect(nextId: string) {
    const match = landownerOptions.find((owner) => owner.id === nextId) ?? null
    setSelectedOwner(match)
    setErrors((current) => ({ ...current, landownerId: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: AddOwnershipErrors = {}
    const landownerId = canReadLandowners
      ? (selectedOwner?.id ?? '')
      : manualLandownerId.trim()

    if (!landownerId) {
      nextErrors.landownerId = canReadLandowners
        ? 'Select a landowner.'
        : 'Enter the landowner ID.'
    } else if (!canReadLandowners && !UUID_PATTERN.test(landownerId)) {
      nextErrors.landownerId = 'Enter a valid UUID.'
    }

    const shareValue = Number(share.trim())
    if (!share.trim()) {
      nextErrors.share = 'Enter a share percentage.'
    } else if (!SHARE_PATTERN.test(share.trim()) || !Number.isFinite(shareValue)) {
      nextErrors.share = 'Use a number with at most two decimal places.'
    } else if (shareValue <= 0) {
      nextErrors.share = 'The share must be greater than 0%.'
    } else if (shareValue > remaining) {
      nextErrors.share = `The remaining share is ${formatNumber(remaining)}%.`
    }

    if (!basis) {
      nextErrors.basis = 'Select the ownership basis.'
    }
    if (!fromDate) {
      nextErrors.fromDate = 'Enter the start date.'
    } else if (fromDate > todayIso()) {
      nextErrors.fromDate = 'The start date cannot be in the future.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        addOwnership(parcel.id, {
          landownerId,
          sharePercent: shareValue,
          basis: basis as OwnershipBasis,
          fromDate,
          remarks: remarks.trim() || null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Owner added.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message; the form stays filled in.
    }
  }

  return (
    <Modal
      title="Add owner"
      description="The owner must already be registered in the parcel's district."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-ownership-form" isLoading={mutation.isLoading}>
            Add owner
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The owner was not added" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="add-ownership-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {canReadLandowners ? (
          <>
            <Input
              label="Search landowners"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
              hint="Only landowners in this parcel's district are listed."
            />
            <Select
              label="Landowner"
              required
              value={selectedOwner?.id ?? ''}
              onChange={(event) => handleOwnerSelect(event.target.value)}
              error={errors.landownerId}
              disabled={landownerQuery.isLoading}
              hint={
                landownerQuery.isLoading
                  ? 'Loading landowners…'
                  : landownerOptions.length === 0
                    ? 'No landowner matches this search.'
                    : 'The backend checks that the owner belongs to the parcel district.'
              }
            >
              <option value="">Select a landowner</option>
              {selectedOwner && !selectedIsListed ? (
                <option value={selectedOwner.id}>{selectedOwner.fullName}</option>
              ) : null}
              {landownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.fullName} · {OWNER_TYPE_LABELS[owner.ownerType]}
                </option>
              ))}
            </Select>
            {landownerQuery.error ? (
              <Alert variant="warning" title="Landowners could not be loaded">
                {landownerQuery.error.message}
              </Alert>
            ) : null}
          </>
        ) : (
          <Input
            label="Landowner ID"
            required
            value={manualLandownerId}
            onChange={(event) => {
              setManualLandownerId(event.target.value)
              setErrors((current) => ({ ...current, landownerId: undefined }))
            }}
            error={errors.landownerId}
            hint="Your role cannot list landowner names, so enter the exact UUID supplied by an officer."
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Share (%)"
            required
            inputMode="decimal"
            value={share}
            onChange={(event) => {
              setShare(event.target.value)
              setErrors((current) => ({ ...current, share: undefined }))
            }}
            error={errors.share}
            hint={`Remaining share: ${formatNumber(remaining)}%.`}
          />
          <Select
            label="Basis"
            required
            value={basis}
            onChange={(event) => {
              setBasis(event.target.value as OwnershipBasis | '')
              setErrors((current) => ({ ...current, basis: undefined }))
            }}
            error={errors.basis}
          >
            <option value="">Select a basis</option>
            {(Object.keys(OWNERSHIP_BASIS_LABELS) as OwnershipBasis[]).map((value) => (
              <option key={value} value={value}>
                {OWNERSHIP_BASIS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="From date"
          type="date"
          required
          max={todayIso()}
          value={fromDate}
          onChange={(event) => {
            setFromDate(event.target.value)
            setErrors((current) => ({ ...current, fromDate: undefined }))
          }}
          error={errors.fromDate}
          hint="The backend does not accept a future start date."
        />

        <Textarea
          label="Remarks"
          value={remarks}
          maxLength={500}
          onChange={(event) => setRemarks(event.target.value)}
          hint="Optional, up to 500 characters."
        />
      </form>
    </Modal>
  )
}

function EndOwnershipDialog({
  parcel,
  ownership,
  onClose,
  onSaved,
}: {
  parcel: ParcelResponse
  ownership: OwnershipResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<OwnershipResponse>()
  const [endDate, setEndDate] = useState(todayIso())
  const [error, setError] = useState<string | undefined>()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    if (!endDate) {
      setError('Enter the end date.')
      return
    }
    if (endDate < ownership.fromDate) {
      setError('The end date cannot be before the start date.')
      return
    }
    if (endDate > todayIso()) {
      setError('The end date cannot be in the future.')
      return
    }

    try {
      await mutation.mutate(() =>
        endOwnership(parcel.id, ownership.id, { endDate }),
      )
      dispatch(addToast({ variant: 'success', message: 'Ownership ended.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="End ownership"
      description={
        ownership.ownerName
          ? `${ownership.ownerName} · ${formatNumber(ownership.sharePercent)}%`
          : `Share ${formatNumber(ownership.sharePercent)}% · owner name hidden`
      }
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="end-ownership-form" isLoading={mutation.isLoading}>
            End ownership
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The ownership was not ended" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="end-ownership-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="End date"
          type="date"
          required
          min={ownership.fromDate}
          max={todayIso()}
          value={endDate}
          onChange={(event) => {
            setEndDate(event.target.value)
            setError(undefined)
          }}
          error={error}
          hint="The ownership stops being current on this date."
        />
      </form>
    </Modal>
  )
}
