import { useState, type FormEvent, type ReactNode } from 'react'
import { PlusCircle, UserRound } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  createLandowner,
  getLandowner,
  getLandowners,
  updateLandowner,
} from '../../api/landRecords'
import type {
  LandownerRequest,
  LandownerResponse,
  LandownerSummary,
  OwnerType,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useDebounce } from '../../hooks/useDebounce'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDateTime } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { OWNER_TYPE_LABELS } from './labels'

const FILTER_ALL = ''
const PHONE_PATTERN = /^[0-9+\- ]{6,20}$/

export function LandownerListPage() {
  const { can } = useAuth()
  const refs = useReferenceNames()
  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [name, setName] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<LandownerResponse | null>(null)

  const debouncedName = useDebounce(name.trim(), 300)
  const canWrite = can(PERMISSION.LAND_RECORD_WRITE)

  const query = useApiQuery(
    () =>
      getLandowners({
        districtId: districtId || undefined,
        name: debouncedName || undefined,
        page,
        size,
      }),
    [districtId, debouncedName, page, size],
  )

  const rows = query.data?.content ?? []
  const hasFilters = districtId !== FILTER_ALL || debouncedName.length > 0

  function changeDistrict(next: string) {
    setDistrictId(next)
    setPage(0)
  }

  function changeName(next: string) {
    setName(next)
    setPage(0)
  }

  function clearFilters() {
    setDistrictId(FILTER_ALL)
    setName('')
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === districtId,
  )

  const columns: TableColumn<LandownerSummary>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (landowner) => (
        <button
          type="button"
          onClick={() => setDetailsId(landowner.id)}
          className="text-left font-semibold text-navy-900 hover:text-blue-700"
        >
          {landowner.fullName}
        </button>
      ),
    },
    {
      key: 'type',
      header: 'Owner type',
      render: (landowner) => OWNER_TYPE_LABELS[landowner.ownerType],
    },
    {
      key: 'district',
      header: 'District',
      render: (landowner) =>
        refs.districtName(landowner.districtId) ?? (
          <span className="text-slate-500">—</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (landowner) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDetailsId(landowner.id)}
          leftIcon={<UserRound aria-hidden="true" className="h-3.5 w-3.5" />}
        >
          View details
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Land records"
        title="Landowners"
        description="Names only in the list. Address and phone are revealed on demand and every view is audited."
        actions={
          canWrite ? (
            <Button
              onClick={() => setCreateOpen(true)}
              leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
            >
              New landowner
            </Button>
          ) : null
        }
      />

      <Alert variant="warning" title="Personal data" className="mb-4">
        Personal data: every view is recorded in the audit trail. Landowner details are never saved
        in this browser's persistent storage.
      </Alert>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Select
            label="District"
            value={districtId}
            onChange={(event) => changeDistrict(event.target.value)}
            disabled={!refs.enabled || refs.isLoading || refs.error !== null}
            hint={
              refs.enabled
                ? 'Only districts in your scope are listed.'
                : 'District names are not available to your role.'
            }
          >
            <option value={FILTER_ALL}>All districts</option>
            {districtOptions.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </Select>

          <Input
            label="Name"
            value={name}
            onChange={(event) => changeName(event.target.value)}
            placeholder="Search by name"
            hint="The backend matches the name and applies your geographic scope."
          />

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
            <Button variant="outline" onClick={query.reload} disabled={query.isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {query.data ? (
          <p className="mt-3 text-xs text-slate-500">
            {query.data.totalElements}{' '}
            {query.data.totalElements === 1 ? 'landowner' : 'landowners'}
            {hasFilters ? ' match your filters' : ' visible to you'}
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 403 ? 'You do not have access' : 'Could not load landowners'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(landowner) => landowner.id}
          isLoading={query.isLoading}
          caption="Landowners visible to you"
          emptyTitle={hasFilters ? 'No landowners match these filters' : 'No landowners yet'}
          emptyDescription={
            hasFilters
              ? 'Try another district or name, or clear the filters.'
              : canWrite
                ? 'Create the first landowner for a district in your scope.'
                : 'No landowners are visible to your account yet.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canWrite ? (
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                New landowner
              </Button>
            ) : undefined
          }
          page={query.data?.page ?? page}
          size={query.data?.size ?? size}
          totalElements={query.data?.totalElements ?? 0}
          totalPages={query.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={changeSize}
        />
      )}

      {detailsId ? (
        <LandownerDetailsDialog
          id={detailsId}
          canWrite={canWrite}
          onClose={() => setDetailsId(null)}
          onEdit={(landowner) => {
            setDetailsId(null)
            setEditing(landowner)
          }}
        />
      ) : null}

      {createOpen ? (
        <LandownerFormDialog
          defaultDistrictId={districtId || undefined}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            query.reload()
          }}
        />
      ) : null}

      {editing ? (
        <LandownerFormDialog
          landowner={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.reload()
          }}
        />
      ) : null}
    </>
  )
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  )
}

function Identifier({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className="break-all font-mono text-xs text-slate-700">{value}</span>
        <CopyButton value={value} label={label} />
      </dd>
    </div>
  )
}

function LandownerDetailsDialog({
  id,
  canWrite,
  onClose,
  onEdit,
}: {
  id: string
  canWrite: boolean
  onClose: () => void
  onEdit: (landowner: LandownerResponse) => void
}) {
  const refs = useReferenceNames()
  const query = useApiQuery(() => getLandowner(id), [id])
  const landowner = query.data

  return (
    <Modal
      title="Landowner details"
      description="This view is recorded in the audit trail."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canWrite && landowner ? (
            <Button onClick={() => onEdit(landowner)}>Edit landowner</Button>
          ) : null}
        </>
      }
    >
      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : query.error ? (
        <ErrorState
          title="Could not load landowner"
          message={query.error.message}
          onRetry={query.reload}
        />
      ) : landowner ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-navy-900">{landowner.fullName}</h3>
            <p className="text-sm text-slate-500">
              {OWNER_TYPE_LABELS[landowner.ownerType]} ·{' '}
              {refs.districtName(landowner.districtId) ?? 'District name not available'}
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Guardian name">
              {landowner.guardianName || 'Not recorded'}
            </DetailItem>
            <DetailItem label="Phone">{landowner.phone || 'Not recorded'}</DetailItem>
            <DetailItem label="Address">
              <span className="whitespace-pre-wrap">{landowner.address || 'Not recorded'}</span>
            </DetailItem>
            <DetailItem label="Last updated">{formatDateTime(landowner.updatedAt)}</DetailItem>
            <DetailItem label="Created">{formatDateTime(landowner.createdAt)}</DetailItem>
          </dl>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Identifiers
            </p>
            <dl className="mt-2">
              <Identifier label="Landowner ID" value={landowner.id} />
              <Identifier label="District ID" value={landowner.districtId} />
            </dl>
          </div>

          <p className="text-xs text-slate-500">
            Aadhaar and other government ID numbers are not stored or displayed by this system.
          </p>
        </div>
      ) : (
        <ErrorState title="Landowner not found" message="It may not exist, or you may not have access." />
      )}
    </Modal>
  )
}

interface LandownerFormValues {
  districtId: string
  ownerType: OwnerType
  fullName: string
  guardianName: string
  address: string
  phone: string
}

type LandownerFormErrors = Partial<Record<keyof LandownerFormValues, string>>

function toFormValues(
  landowner: LandownerResponse | null,
  defaultDistrictId?: string,
): LandownerFormValues {
  return {
    districtId: landowner?.districtId ?? defaultDistrictId ?? '',
    ownerType: landowner?.ownerType ?? 'INDIVIDUAL',
    fullName: landowner?.fullName ?? '',
    guardianName: landowner?.guardianName ?? '',
    address: landowner?.address ?? '',
    phone: landowner?.phone ?? '',
  }
}

function validate(values: LandownerFormValues): LandownerFormErrors {
  const errors: LandownerFormErrors = {}
  if (!values.districtId) {
    errors.districtId = 'Select a district.'
  }
  if (!values.fullName.trim()) {
    errors.fullName = 'Enter the full name.'
  } else if (values.fullName.trim().length > 200) {
    errors.fullName = 'Use at most 200 characters.'
  }
  if (values.guardianName.trim().length > 200) {
    errors.guardianName = 'Use at most 200 characters.'
  }
  if (values.address.trim().length > 500) {
    errors.address = 'Use at most 500 characters.'
  }
  const phone = values.phone.trim()
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = 'Use 6 to 20 digits, spaces, plus or hyphen.'
  }
  return errors
}

function toRequest(values: LandownerFormValues): LandownerRequest {
  return {
    districtId: values.districtId,
    ownerType: values.ownerType,
    fullName: values.fullName.trim(),
    guardianName: values.guardianName.trim() || null,
    address: values.address.trim() || null,
    phone: values.phone.trim() || null,
  }
}

function LandownerFormDialog({
  landowner,
  defaultDistrictId,
  onClose,
  onSaved,
}: {
  landowner?: LandownerResponse
  defaultDistrictId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const refs = useReferenceNames()
  const mutation = useApiMutation<LandownerResponse>()
  const [values, setValues] = useState<LandownerFormValues>(() =>
    toFormValues(landowner ?? null, defaultDistrictId),
  )
  const [errors, setErrors] = useState<LandownerFormErrors>({})

  const isEdit = Boolean(landowner)
  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === values.districtId,
  )

  function updateValue<K extends keyof LandownerFormValues>(
    key: K,
    value: LandownerFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const request = toRequest(values)
    try {
      await mutation.mutate(() =>
        landowner ? updateLandowner(landowner.id, request) : createLandowner(request),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: landowner ? 'Landowner updated.' : 'Landowner created.',
        }),
      )
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit landowner' : 'New landowner'}
      description={
        isEdit
          ? 'The district cannot be changed after a landowner is created.'
          : 'Personal data is stored by the backend and every view is audited.'
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="landowner-form" isLoading={mutation.isLoading}>
            {isEdit ? 'Save changes' : 'Create landowner'}
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The landowner was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      {!refs.enabled ? (
        <Alert variant="warning" title="District list unavailable" className="mb-4">
          Your role cannot read master data. A district is required, so ask an administrator to
          assign the right access.
        </Alert>
      ) : null}

      <form id="landowner-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="District"
            required
            value={values.districtId}
            onChange={(event) => updateValue('districtId', event.target.value)}
            error={errors.districtId}
            disabled={isEdit || !refs.enabled || refs.isLoading}
            hint={
              isEdit
                ? 'The district of an existing landowner is read-only.'
                : 'Only districts in your scope are listed.'
            }
          >
            <option value="">Select a district</option>
            {districtOptions.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </Select>

          <Select
            label="Owner type"
            required
            value={values.ownerType}
            onChange={(event) => updateValue('ownerType', event.target.value as OwnerType)}
          >
            {(Object.keys(OWNER_TYPE_LABELS) as OwnerType[]).map((value) => (
              <option key={value} value={value}>
                {OWNER_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Full name"
          required
          maxLength={200}
          value={values.fullName}
          onChange={(event) => updateValue('fullName', event.target.value)}
          error={errors.fullName}
        />

        <Input
          label="Guardian name"
          maxLength={200}
          value={values.guardianName}
          onChange={(event) => updateValue('guardianName', event.target.value)}
          error={errors.guardianName}
          hint="Optional."
        />

        <Textarea
          label="Address"
          maxLength={500}
          value={values.address}
          onChange={(event) => updateValue('address', event.target.value)}
          error={errors.address}
          hint="Optional, up to 500 characters."
        />

        <Input
          label="Phone"
          maxLength={20}
          value={values.phone}
          onChange={(event) => updateValue('phone', event.target.value)}
          error={errors.phone}
          hint="Optional. 6 to 20 digits, spaces, plus or hyphen."
        />
      </form>
    </Modal>
  )
}
