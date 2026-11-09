import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Power, PowerOff } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { toApiErrorInfo } from '../../api/errors'
import { getParcel, setParcelStatus } from '../../api/landRecords'
import type { ParcelResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import {
  useReferenceNames,
  type ReferenceNamesResult,
} from '../../hooks/useReferenceNames'
import { formatArea, formatDateTime } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { BoundaryTab } from '../gis/BoundaryTab'
import { DocumentsTab } from './DocumentsTab'
import {
  LAND_CLASSIFICATION_LABELS,
  LAND_USE_LABELS,
  PARCEL_STATUS_LABELS,
  PARCEL_STATUS_VARIANTS,
  parcelIdentifier,
} from './labels'
import { MutationsTab } from './MutationsTab'
import { OwnersTab } from './OwnersTab'
import { RevenueRecordsTab } from './RevenueRecordsTab'

function ParcelDetailsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function ParcelDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const query = useApiQuery<ParcelResponse | null>(
    () => (id ? getParcel(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  if (query.isLoading) {
    return <ParcelDetailsSkeleton />
  }

  if (query.error) {
    return (
      <>
        <PageHeader
          eyebrow="Module 3 · Land records"
          title="Parcel"
          description="The parcel could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              query.error.status === 404
                ? 'Parcel not found'
                : query.error.status === 403
                  ? 'You do not have access'
                  : 'Could not load parcel'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/land/parcels" variant="outline">
              Back to parcels
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  if (!query.data) {
    return (
      <>
        <PageHeader eyebrow="Module 3 · Land records" title="Parcel" />
        <Card>
          <ErrorState
            title="Parcel not found"
            message="It may not exist, or you may not have access to it."
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/land/parcels" variant="outline">
              Back to parcels
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  return <ParcelDetails parcel={query.data} onChanged={query.reload} />
}

function ParcelDetails({
  parcel,
  onChanged,
}: {
  parcel: ParcelResponse
  onChanged: () => void
}) {
  const { can } = useAuth()
  const refs = useReferenceNames()
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState('overview')
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [villageError, setVillageError] = useState<string | null>(null)
  const statusMutation = useApiMutation<ParcelResponse>()

  const canWrite = can(PERMISSION.LAND_RECORD_WRITE)
  const canReadDocuments = can(PERMISSION.DOCUMENT_READ)
  const canReadGis = can(PERMISSION.GIS_READ)
  const isActive = parcel.status === 'ACTIVE'
  const { ensureDistrictVillages, enabled } = refs

  useEffect(() => {
    if (!enabled) {
      setVillageError(null)
      return
    }

    let active = true
    setVillageError(null)
    ensureDistrictVillages(parcel.districtId).catch((caught: unknown) => {
      if (active) {
        setVillageError(toApiErrorInfo(caught).message)
      }
    })

    return () => {
      active = false
    }
  }, [enabled, ensureDistrictVillages, parcel.districtId])

  async function changeStatus() {
    if (statusMutation.isLoading) {
      return
    }

    const next = isActive ? 'INACTIVE' : 'ACTIVE'
    try {
      await statusMutation.mutate(() => setParcelStatus(parcel.id, next))
      dispatch(
        addToast({
          variant: 'success',
          message: next === 'ACTIVE' ? 'Parcel activated.' : 'Parcel deactivated.',
        }),
      )
      setStatusDialogOpen(false)
      onChanged()
    } catch {
      // The dialog stays open and shows the backend message.
    }
  }

  const tabs: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <ParcelOverview
          parcel={parcel}
          refs={refs}
          villageError={villageError}
        />
      ),
    },
    {
      id: 'owners',
      label: 'Owners',
      content: <OwnersTab parcel={parcel} />,
    },
    {
      id: 'mutations',
      label: 'Mutations',
      content: <MutationsTab parcel={parcel} />,
    },
    {
      id: 'revenue',
      label: '7/12 and 8A',
      content: <RevenueRecordsTab parcel={parcel} />,
    },
  ]

  if (canReadDocuments) {
    tabs.push({
      id: 'documents',
      label: 'Documents',
      content: <DocumentsTab parcel={parcel} />,
    })
  }

  if (canReadGis) {
    tabs.push({
      id: 'boundary',
      label: 'Boundary',
      content: <BoundaryTab parcel={parcel} />,
    })
  }

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Land records"
        title={parcelIdentifier(parcel)}
        description="Parcel details, ownership, mutations, revenue extracts and supporting documents."
        actions={
          <>
            <LinkButton
              to="/land/parcels"
              variant="outline"
              leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
            >
              Back to parcels
            </LinkButton>
            {canWrite ? (
              <>
                <LinkButton
                  to={`/land/parcels/${parcel.id}/edit`}
                  variant="outline"
                  leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                >
                  Edit parcel
                </LinkButton>
                <Button
                  variant={isActive ? 'outline' : 'primary'}
                  onClick={() => setStatusDialogOpen(true)}
                  leftIcon={
                    isActive ? (
                      <PowerOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Power aria-hidden="true" className="h-4 w-4" />
                    )
                  }
                >
                  {isActive ? 'Deactivate parcel' : 'Activate parcel'}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Badge variant={PARCEL_STATUS_VARIANTS[parcel.status]}>
          {PARCEL_STATUS_LABELS[parcel.status]}
        </Badge>
        <p className="text-sm text-slate-600">
          {refs.villageName(parcel.villageId) ?? 'Village name not available'} ·{' '}
          {formatArea(parcel.areaHa)} · {LAND_CLASSIFICATION_LABELS[parcel.classification]}
        </p>
        {!isActive ? (
          <p className="text-sm font-medium text-warning-700">
            An inactive parcel cannot be changed until it is activated.
          </p>
        ) : null}
      </Card>

      {statusMutation.error ? (
        <Alert variant="error" title="The parcel status was not changed" className="mb-4">
          {statusMutation.error.message}
        </Alert>
      ) : null}

      <Card className="p-4">
        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} label="Parcel sections" />
      </Card>

      {statusDialogOpen ? (
        <ConfirmDialog
          title={isActive ? 'Deactivate this parcel?' : 'Activate this parcel?'}
          message={
            isActive
              ? 'Ownership, mutations, revenue records and documents cannot be changed while the parcel is inactive. You can activate it again later.'
              : 'The parcel becomes available for ownership, mutation, revenue and document changes again.'
          }
          confirmLabel={isActive ? 'Deactivate parcel' : 'Activate parcel'}
          variant={isActive ? 'danger' : 'primary'}
          isLoading={statusMutation.isLoading}
          onConfirm={() => void changeStatus()}
          onClose={() => {
            if (!statusMutation.isLoading) {
              statusMutation.reset()
              setStatusDialogOpen(false)
            }
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

function nameOrFallback(name: string | null): ReactNode {
  return name ?? <span className="text-slate-500">Name not available to your role</span>
}

function ParcelOverview({
  parcel,
  refs,
  villageError,
}: {
  parcel: ParcelResponse
  refs: ReferenceNamesResult
  villageError: string | null
}) {
  return (
    <div className="space-y-4">
      {!refs.enabled ? (
        <Alert variant="info" title="Administrative names are not available">
          Your role cannot read master data, so only the parcel identifiers and values returned by
          the backend are shown. The full identifiers are listed with copy buttons below.
        </Alert>
      ) : null}

      {villageError ? (
        <Alert variant="warning" title="Village names could not be loaded">
          {villageError}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeader
            title="Location"
            description="Names come from master data; the backend decides which places are visible."
          />
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <DetailItem label="District">
              {nameOrFallback(refs.districtName(parcel.districtId))}
            </DetailItem>
            <DetailItem label="Taluka">
              {nameOrFallback(refs.talukaName(parcel.talukaId))}
            </DetailItem>
            <DetailItem label="Village">
              {nameOrFallback(refs.villageName(parcel.villageId))}
            </DetailItem>
          </dl>
        </Card>

        <Card className="p-4">
          <CardHeader title="Land details" description="Area is recorded in hectares." />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Gat number">{parcel.gatNumber ?? '—'}</DetailItem>
            <DetailItem label="Survey number">{parcel.surveyNumber ?? '—'}</DetailItem>
            <DetailItem label="Subdivision">{parcel.subdivisionNumber ?? '—'}</DetailItem>
            <DetailItem label="Area">{formatArea(parcel.areaHa)}</DetailItem>
            <DetailItem label="Classification">
              {LAND_CLASSIFICATION_LABELS[parcel.classification]}
            </DetailItem>
            <DetailItem label="Land use">{LAND_USE_LABELS[parcel.landUse]}</DetailItem>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeader title="Record" description="Timestamps are shown in en-IN format." />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Created">{formatDateTime(parcel.createdAt)}</DetailItem>
            <DetailItem label="Last updated">{formatDateTime(parcel.updatedAt)}</DetailItem>
            <DetailItem label="Status">
              <Badge variant={PARCEL_STATUS_VARIANTS[parcel.status]}>
                {PARCEL_STATUS_LABELS[parcel.status]}
              </Badge>
            </DetailItem>
          </dl>
        </Card>

        <Card className="p-4">
          <CardHeader
            title="Identifiers"
            description="Full UUIDs are shown only in details, with a copy button."
          />
          <dl className="mt-3">
            <Identifier label="Parcel ID" value={parcel.id} />
            <Identifier label="State ID" value={parcel.stateId} />
            <Identifier label="District ID" value={parcel.districtId} />
            <Identifier label="Taluka ID" value={parcel.talukaId} />
            <Identifier label="Village ID" value={parcel.villageId} />
          </dl>
        </Card>
      </div>
    </div>
  )
}
