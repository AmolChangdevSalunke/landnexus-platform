import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Files, RotateCcw } from 'lucide-react'
import { toApiErrorInfo } from '../../api/errors'
import { getParcel, getParcels } from '../../api/landRecords'
import type { ParcelResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery, type UseApiQueryResult } from '../../hooks/useApiQuery'
import { useDebounce } from '../../hooks/useDebounce'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatArea, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { DocumentsTab } from './DocumentsTab'
import {
  PARCEL_STATUS_LABELS,
  PARCEL_STATUS_VARIANTS,
  parcelIdentifier,
} from './labels'

const FILTER_ALL = ''

/**
 * Standalone document register. The backend lists documents per parcel, so the
 * register starts with a parcel search and then shows that parcel's documents.
 * The selected parcel is kept in the URL so a register view can be shared.
 */
export function DocumentRegisterPage() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('parcelId') ?? ''
  const canReadDocuments = can(PERMISSION.DOCUMENT_READ)

  const selectedQuery = useApiQuery<ParcelResponse | null>(
    () => (selectedId ? getParcel(selectedId) : Promise.resolve(null)),
    [selectedId],
    Boolean(selectedId),
  )

  function openParcel(parcelId: string) {
    setParams({ parcelId })
  }

  function clearParcel() {
    setParams({})
  }

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Land records"
        title="Document register"
        description="Documents are stored against a parcel. Find the parcel, then review, download, verify or upload its documents."
        actions={
          selectedId ? (
            <Button variant="outline" onClick={clearParcel}>
              Change parcel
            </Button>
          ) : undefined
        }
      />

      {!canReadDocuments ? (
        <Alert
          variant="warning"
          title="Document access is not assigned to your role"
          className="mb-4"
        >
          You can search parcels, but reading or downloading documents needs the
          DOCUMENT_READ permission.
        </Alert>
      ) : null}

      {selectedId ? (
        <SelectedParcel
          query={selectedQuery}
          canReadDocuments={canReadDocuments}
          onClear={clearParcel}
        />
      ) : (
        <ParcelFinder onOpen={openParcel} disabled={!canReadDocuments} />
      )}
    </>
  )
}

function SelectedParcel({
  query,
  canReadDocuments,
  onClear,
}: {
  query: UseApiQueryResult<ParcelResponse | null>
  canReadDocuments: boolean
  onClear: () => void
}) {
  const refs = useReferenceNames()

  if (query.isLoading) {
    return (
      <Card className="space-y-3 p-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-20 w-full" />
      </Card>
    )
  }

  if (query.error) {
    return (
      <Card>
        <ErrorState
          title={
            query.error.status === 404
              ? 'Parcel not found'
              : query.error.status === 403
                ? 'You do not have access to this parcel'
                : 'Could not load the parcel'
          }
          message={query.error.message}
          onRetry={query.reload}
        />
        <div className="flex justify-center pb-6">
          <Button variant="outline" onClick={onClear}>
            Choose another parcel
          </Button>
        </div>
      </Card>
    )
  }

  const parcel = query.data
  if (!parcel) {
    return null
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Selected parcel
          </p>
          <p className="mt-1 text-base font-semibold text-navy-900">
            {parcelIdentifier(parcel)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {refs.villageName(parcel.villageId) ?? shortId(parcel.villageId)} ·{' '}
            {formatArea(parcel.areaHa)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={PARCEL_STATUS_VARIANTS[parcel.status]}>
            {PARCEL_STATUS_LABELS[parcel.status]}
          </Badge>
          <LinkButton to={`/land/parcels/${parcel.id}`} variant="outline" size="sm">
            Parcel details
          </LinkButton>
        </div>
      </Card>

      {canReadDocuments ? (
        <DocumentsTab parcel={parcel} />
      ) : (
        <Card className="p-4">
          <p className="text-sm text-slate-600">
            Your role cannot read documents for this parcel.
          </p>
        </Card>
      )}
    </div>
  )
}

function ParcelFinder({
  onOpen,
  disabled,
}: {
  onOpen: (parcelId: string) => void
  disabled: boolean
}) {
  const refs = useReferenceNames()
  const { ensureDistrictVillages } = refs
  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [villageId, setVillageId] = useState(FILTER_ALL)
  const [number, setNumber] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [villageError, setVillageError] = useState<string | null>(null)

  const debouncedNumber = useDebounce(number.trim(), 300)

  useEffect(() => {
    if (!districtId) {
      setVillageError(null)
      return
    }

    let active = true
    setVillageError(null)
    ensureDistrictVillages(districtId).catch((caught: unknown) => {
      if (active) {
        setVillageError(toApiErrorInfo(caught).message)
      }
    })

    return () => {
      active = false
    }
  }, [districtId, ensureDistrictVillages])

  const query = useApiQuery(
    () =>
      getParcels({
        districtId: districtId || undefined,
        villageId: villageId || undefined,
        number: debouncedNumber || undefined,
        page,
        size,
      }),
    [districtId, villageId, debouncedNumber, page, size],
  )

  const hasFilters =
    districtId !== FILTER_ALL || villageId !== FILTER_ALL || debouncedNumber.length > 0
  const rows = query.data?.content ?? []

  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === districtId,
  )
  const districtFilterDisabled = !refs.enabled || refs.isLoading || refs.error !== null
  const villages = districtId ? refs.villagesForDistrict(districtId) : []
  const villagesLoading = districtId ? refs.isDistrictVillagesLoading(districtId) : false

  function changeDistrict(next: string) {
    setDistrictId(next)
    setVillageId(FILTER_ALL)
    setPage(0)
  }

  function changeVillage(next: string) {
    setVillageId(next)
    setPage(0)
  }

  function changeNumber(next: string) {
    setNumber(next)
    setPage(0)
  }

  function clearFilters() {
    setDistrictId(FILTER_ALL)
    setVillageId(FILTER_ALL)
    setNumber('')
    setPage(0)
  }

  const columns: TableColumn<ParcelResponse>[] = [
    {
      key: 'gat',
      header: 'Gat',
      render: (parcel) =>
        parcel.gatNumber ? (
          <span className="font-semibold text-navy-900">{parcel.gatNumber}</span>
        ) : (
          <span className="text-slate-500">—</span>
        ),
    },
    {
      key: 'survey',
      header: 'Survey',
      render: (parcel) => parcel.surveyNumber || <span className="text-slate-500">—</span>,
    },
    {
      key: 'village',
      header: 'Village',
      render: (parcel) => (
        <span title={parcel.villageId}>
          {refs.villageName(parcel.villageId) ?? shortId(parcel.villageId)}
        </span>
      ),
    },
    {
      key: 'area',
      header: 'Area',
      render: (parcel) => (
        <span className="whitespace-nowrap">{formatArea(parcel.areaHa)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (parcel) => (
        <Badge variant={PARCEL_STATUS_VARIANTS[parcel.status]}>
          {PARCEL_STATUS_LABELS[parcel.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (parcel) => (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onOpen(parcel.id)}
        >
          Open register
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Find a parcel"
          description="Only parcels inside your role and geographic scope are listed. The backend decides what is visible."
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={clearFilters}
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              >
                Clear filters
              </Button>
            ) : null
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Select
            label="District"
            value={districtId}
            onChange={(event) => changeDistrict(event.target.value)}
            disabled={districtFilterDisabled}
            hint={
              districtFilterDisabled
                ? 'District names are not available right now.'
                : 'Only districts in your scope are listed.'
            }
          >
            <option value={FILTER_ALL}>All districts</option>
            {districtOptions.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </Select>

          <Select
            label="Village"
            value={villageId}
            onChange={(event) => changeVillage(event.target.value)}
            disabled={!districtId || villagesLoading}
            hint={
              districtId
                ? 'Villages are loaded for the selected district.'
                : 'Select a district first.'
            }
          >
            <option value={FILTER_ALL}>All villages</option>
            {villages.map((village) => (
              <option key={village.id} value={village.id}>
                {village.name}
              </option>
            ))}
          </Select>

          <Input
            label="Gat or survey number"
            value={number}
            onChange={(event) => changeNumber(event.target.value)}
            placeholder="For example 123 or 45/2"
            hint="The backend matches either the Gat or the Survey number."
          />

          <div className="flex justify-end">
            <Button variant="outline" onClick={query.reload} disabled={query.isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {villageError ? (
          <p role="alert" className="mt-3 text-xs font-medium text-danger-700">
            Village names could not be loaded. {villageError}
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 403
                ? 'You do not have access'
                : 'Could not load parcels'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(parcel) => parcel.id}
          isLoading={query.isLoading}
          caption="Parcels available for the document register"
          emptyTitle={hasFilters ? 'No parcels match these filters' : 'No parcels yet'}
          emptyDescription={
            hasFilters
              ? 'Try another district, village or number, or clear the filters.'
              : 'Parcels will appear here once they are recorded.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
          page={query.data?.page ?? page}
          size={query.data?.size ?? size}
          totalElements={query.data?.totalElements ?? 0}
          totalPages={query.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setSize(next)
            setPage(0)
          }}
        />
      )}

      {query.data ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Files aria-hidden="true" className="h-3.5 w-3.5" />
          {query.data.totalElements}{' '}
          {query.data.totalElements === 1 ? 'parcel' : 'parcels'}
          {hasFilters ? ' match your filters' : ' are available'}.
        </p>
      ) : null}
    </div>
  )
}
