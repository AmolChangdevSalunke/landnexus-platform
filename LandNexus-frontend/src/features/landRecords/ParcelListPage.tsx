import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, RotateCcw } from 'lucide-react'
import { toApiErrorInfo } from '../../api/errors'
import { getParcels } from '../../api/landRecords'
import type { ParcelResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useDebounce } from '../../hooks/useDebounce'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatArea, formatDate, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import {
  LAND_CLASSIFICATION_LABELS,
  PARCEL_STATUS_LABELS,
  PARCEL_STATUS_VARIANTS,
} from './labels'

const FILTER_ALL = ''

export function ParcelListPage() {
  const { can } = useAuth()
  const refs = useReferenceNames()
  const canWrite = can(PERMISSION.LAND_RECORD_WRITE)
  const canReadDocuments = can(PERMISSION.DOCUMENT_READ)

  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [villageId, setVillageId] = useState(FILTER_ALL)
  const [number, setNumber] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [villageLoad, setVillageLoad] = useState<{
    districtId: string
    isLoading: boolean
    error: string | null
  }>({ districtId: '', isLoading: false, error: null })

  const debouncedNumber = useDebounce(number.trim(), 300)

  const { ensureDistrictVillages } = refs

  useEffect(() => {
    if (!districtId) {
      setVillageLoad({ districtId: '', isLoading: false, error: null })
      return
    }

    let active = true
    setVillageLoad({ districtId, isLoading: true, error: null })

    ensureDistrictVillages(districtId)
      .then(() => {
        if (active) {
          setVillageLoad({ districtId, isLoading: false, error: null })
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setVillageLoad({
            districtId,
            isLoading: false,
            error: toApiErrorInfo(caught).message,
          })
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
    districtId !== FILTER_ALL ||
    villageId !== FILTER_ALL ||
    debouncedNumber.length > 0
  const rows = query.data?.content ?? []

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

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === districtId,
  )
  const districtFilterDisabled = !refs.enabled || refs.isLoading || refs.error !== null
  const villages = districtId ? refs.villagesForDistrict(districtId) : []
  const villagesLoading =
    villageLoad.districtId === districtId && villageLoad.isLoading

  const columns: TableColumn<ParcelResponse>[] = [
    {
      key: 'gat',
      header: 'Gat',
      render: (parcel) =>
        parcel.gatNumber ? (
          <Link
            to={`/land/parcels/${parcel.id}`}
            className="font-semibold text-navy-900 hover:text-blue-700"
          >
            {parcel.gatNumber}
          </Link>
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
      key: 'subdivision',
      header: 'Subdivision',
      render: (parcel) =>
        parcel.subdivisionNumber || <span className="text-slate-500">—</span>,
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
      key: 'classification',
      header: 'Classification',
      render: (parcel) => LAND_CLASSIFICATION_LABELS[parcel.classification],
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
        <div className="flex flex-wrap justify-end gap-2">
          {canReadDocuments ? (
            <LinkButton
              to={`/land/documents?parcelId=${parcel.id}`}
              variant="ghost"
              size="sm"
            >
              Documents
            </LinkButton>
          ) : null}
          <LinkButton to={`/land/parcels/${parcel.id}`} variant="outline" size="sm">
            View
          </LinkButton>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Land records"
        title="Land parcels"
        description="Parcels you can see, based on your role and geographic scope. The backend decides what is visible."
        actions={
          canWrite ? (
            <LinkButton
              to="/land/parcels/new"
              leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
            >
              New parcel
            </LinkButton>
          ) : null
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
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

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {hasFilters ? (
              <Button
                variant="outline"
                onClick={clearFilters}
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              >
                Clear filters
              </Button>
            ) : null}
            <Button variant="outline" onClick={query.reload} disabled={query.isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {villageLoad.districtId === districtId && villageLoad.error ? (
          <p role="alert" className="mt-3 text-xs font-medium text-danger-700">
            Village names could not be loaded. {villageLoad.error}
          </p>
        ) : null}

        {query.data ? (
          <p className="mt-3 text-xs text-slate-500">
            {query.data.totalElements}{' '}
            {query.data.totalElements === 1 ? 'parcel' : 'parcels'}
            {hasFilters ? ' match your filters' : ' visible to you'}
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={query.error.status === 403 ? 'You do not have access' : 'Could not load parcels'}
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
          caption="Land parcels visible to you"
          emptyTitle={hasFilters ? 'No parcels match these filters' : 'No parcels yet'}
          emptyDescription={
            hasFilters
              ? 'Try another district, village or number, or clear the filters.'
              : canWrite
                ? 'Create the first parcel for a village in your scope.'
                : 'No parcels are visible to your account yet.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canWrite ? (
              <LinkButton to="/land/parcels/new">New parcel</LinkButton>
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

      {query.data && query.data.totalElements > 0 ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Badge variant="neutral">Read only list</Badge>
          Last updated {formatDate(rows[0]?.updatedAt)} · ownership is on the parcel details
          page; documents open in the document register.
        </p>
      ) : null}
    </>
  )
}
