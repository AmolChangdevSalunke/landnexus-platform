import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin,
  Pencil,
  PlusCircle,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  assignSurveyor,
  getCaseParcels,
  identifyCaseParcel,
  removeCaseParcel,
  setCaseVillages,
} from '../../api/acquisition'
import { getUsers } from '../../api/admin'
import { getParcel, getParcels } from '../../api/landRecords'
import { getProject } from '../../api/projects'
import type {
  CaseParcel,
  CaseResponse,
  CaseStatus,
  ParcelResponse,
  ProjectResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CopyButton } from '../../components/ui/CopyButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import {
  useReferenceNames,
  type ReferenceNamesResult,
} from '../../hooks/useReferenceNames'
import { formatArea, formatDateTime, shortId } from '../../utils/format'
import { PERMISSION, PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import {
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_VARIANTS,
} from './labels'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MANAGEABLE_PARCEL_STATUSES = new Set<CaseStatus>([
  'INITIATED',
  'SURVEY_IN_PROGRESS',
])

export function VillagesParcelsTab({
  acquisitionCase,
  reloadKey,
  onChanged,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
  onChanged: () => void
}) {
  const { can, canAny } = useAuth()
  const refs = useReferenceNames()
  const canManage = can(PERMISSION.ACQUISITION_MANAGE)
  const canReadParcels = can(PERMISSION.LAND_RECORD_READ)
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)
  const { ensureDistrictVillages, enabled: refsEnabled } = refs

  const parcelsQuery = useApiQuery(
    () => getCaseParcels(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  const projectQuery = useApiQuery<ProjectResponse | null>(
    () =>
      canReadProjects
        ? getProject(acquisitionCase.projectId)
        : Promise.resolve(null),
    [acquisitionCase.projectId, canReadProjects],
    canReadProjects,
  )

  const [villageError, setVillageError] = useState<string | null>(null)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<CaseParcel | null>(null)
  const [assignTarget, setAssignTarget] = useState<CaseParcel | null>(null)

  useEffect(() => {
    if (!refsEnabled) {
      setVillageError(null)
      return
    }

    let active = true
    setVillageError(null)
    ensureDistrictVillages(acquisitionCase.districtId).catch(() => {
      if (active) {
        setVillageError('Village names could not be loaded.')
      }
    })

    return () => {
      active = false
    }
  }, [acquisitionCase.districtId, ensureDistrictVillages, refsEnabled])

  const parcels = parcelsQuery.data ?? []
  const canIdentify = canManage && MANAGEABLE_PARCEL_STATUSES.has(acquisitionCase.status)
  const canEditVillages = canManage && acquisitionCase.status === 'INITIATED'

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Affected villages"
          description="Only villages of the approved project can be selected. The backend enforces the same rule."
          action={
            canEditVillages ? (
              <Badge variant="info">Editable while initiated</Badge>
            ) : (
              <Badge variant="neutral">Read only in this stage</Badge>
            )
          }
        />

        {villageError ? (
          <Alert variant="warning" className="mt-3">
            {villageError} Village identifiers are shown instead of names.
          </Alert>
        ) : null}

        {!refsEnabled ? (
          <Alert variant="info" className="mt-3">
            Your role cannot read administrative master data, so village names are not resolved.
            The backend still validates every village.
          </Alert>
        ) : null}

        {canEditVillages ? (
          <ManageVillages
            acquisitionCase={acquisitionCase}
            project={projectQuery.data}
            projectError={projectQuery.error?.message ?? null}
            isProjectLoading={projectQuery.isLoading}
            refs={refs}
            onSaved={onChanged}
          />
        ) : (
          <VillageChips acquisitionCase={acquisitionCase} refs={refs} />
        )}
      </Card>

      <Card className="p-4">
        <CardHeader
          title="Affected parcels"
          description="The owner snapshot stores landowner IDs and shares only. Names are not exposed here."
          action={
            canIdentify ? (
              <Button
                onClick={() => setIdentifyOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Identify parcel
              </Button>
            ) : null
          }
        />

        {!canReadParcels ? (
          <Alert variant="warning" className="mt-3">
            Your role cannot read the land parcel register, so recorded area and parcel
            identifiers are not resolved. Parcel IDs from the acquisition snapshot are still
            listed.
          </Alert>
        ) : null}

        {parcelsQuery.isLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : parcelsQuery.error ? (
          <div className="mt-4">
            <ErrorState
              title="Could not load affected parcels"
              message={parcelsQuery.error.message}
              onRetry={parcelsQuery.reload}
            />
          </div>
        ) : parcels.length === 0 ? (
          <EmptyState
            title="No parcels identified yet"
            description={
              canIdentify
                ? 'Select a village and identify the parcels the project needs.'
                : 'Parcels appear here once an acquisition officer identifies them.'
            }
            action={
              canIdentify ? (
                <Button variant="outline" onClick={() => setIdentifyOpen(true)}>
                  Identify parcel
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {parcels.map((caseParcel) => (
              <ParcelRow
                key={caseParcel.id}
                caseParcel={caseParcel}
                caseStatus={acquisitionCase.status}
                canManage={canManage}
                canReadParcels={canReadParcels}
                onRemove={() => setRemoveTarget(caseParcel)}
                onAssign={() => setAssignTarget(caseParcel)}
              />
            ))}
          </ul>
        )}

        {acquisitionCase.status === 'INITIATED' && parcels.length > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            A parcel can be removed only before the survey starts and only when it has no
            surveys.
          </p>
        ) : null}
      </Card>

      {identifyOpen ? (
        <IdentifyParcelDialog
          acquisitionCase={acquisitionCase}
          refs={refs}
          canReadParcels={canReadParcels}
          onClose={() => setIdentifyOpen(false)}
          onSaved={() => {
            setIdentifyOpen(false)
            parcelsQuery.reload()
            onChanged()
          }}
        />
      ) : null}

      {removeTarget ? (
        <RemoveParcelDialog
          acquisitionCase={acquisitionCase}
          caseParcel={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onSaved={() => {
            setRemoveTarget(null)
            parcelsQuery.reload()
            onChanged()
          }}
        />
      ) : null}

      {assignTarget ? (
        <AssignSurveyorDialog
          acquisitionCase={acquisitionCase}
          caseParcel={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null)
            parcelsQuery.reload()
            onChanged()
          }}
        />
      ) : null}
    </div>
  )
}

function VillageChips({
  acquisitionCase,
  refs,
}: {
  acquisitionCase: CaseResponse
  refs: ReferenceNamesResult
}) {
  if (acquisitionCase.villageIds.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        No affected villages have been selected yet.
      </p>
    )
  }

  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {acquisitionCase.villageIds.map((villageId) => (
        <li
          key={villageId}
          title={villageId}
          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
        >
          {refs.villageName(villageId) ?? shortId(villageId)}
        </li>
      ))}
    </ul>
  )
}

function ManageVillages({
  acquisitionCase,
  project,
  projectError,
  isProjectLoading,
  refs,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  project: ProjectResponse | null
  projectError: string | null
  isProjectLoading: boolean
  refs: ReferenceNamesResult
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<CaseResponse>()
  const [selected, setSelected] = useState<string[]>(acquisitionCase.villageIds)

  useEffect(() => {
    setSelected(acquisitionCase.villageIds)
  }, [acquisitionCase.villageIds])

  const projectVillages = (project?.villageIds ?? [])
    .slice()
    .sort((a, b) => {
      const left = refs.villageName(a) ?? a
      const right = refs.villageName(b) ?? b
      return left.localeCompare(right)
    })
  const changed =
    selected.length !== acquisitionCase.villageIds.length ||
    selected.some((id) => !acquisitionCase.villageIds.includes(id))
  const villagesLoading = refs.isDistrictVillagesLoading(acquisitionCase.districtId)

  function toggle(villageId: string) {
    setSelected((current) =>
      current.includes(villageId)
        ? current.filter((id) => id !== villageId)
        : [...current, villageId],
    )
  }

  async function save() {
    if (!changed || selected.length === 0 || mutation.isLoading) {
      return
    }

    try {
      await mutation.mutate(() => setCaseVillages(acquisitionCase.id, selected))
      dispatch(addToast({ variant: 'success', message: 'Affected villages updated.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {isProjectLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : projectError ? (
        <Alert variant="warning" title="Project villages could not be loaded">
          {projectError} You can still view the villages already recorded on the case.
        </Alert>
      ) : !project ? (
        <Alert variant="info">
          Project details are not available to your role, so the full project village list
          cannot be shown.
        </Alert>
      ) : (
        <>
          {mutation.error ? (
            <Alert variant="error" title="Villages not updated">
              {mutation.error.message}
            </Alert>
          ) : null}

          {villagesLoading ? (
            <p className="text-xs text-slate-500">Loading project villages…</p>
          ) : null}

          {projectVillages.length === 0 ? (
            <p className="text-sm text-slate-600">
              The approved project has no villages recorded.
            </p>
          ) : (
            <fieldset className="rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Villages of {project.code} ({selected.length} selected)
              </legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {projectVillages.map((villageId) => (
                  <label
                    key={villageId}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(villageId)}
                      onChange={() => toggle(villageId)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span title={villageId}>
                      {refs.villageName(villageId) ?? shortId(villageId)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              A village that already has identified parcels cannot be removed.
            </p>
            <Button
              onClick={() => void save()}
              disabled={!changed || selected.length === 0}
              isLoading={mutation.isLoading}
            >
              Save villages
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function ParcelRow({
  caseParcel,
  caseStatus,
  canManage,
  canReadParcels,
  onRemove,
  onAssign,
}: {
  caseParcel: CaseParcel
  caseStatus: CaseStatus
  canManage: boolean
  canReadParcels: boolean
  onRemove: () => void
  onAssign: () => void
}) {
  const parcelQuery = useApiQuery<ParcelResponse | null>(
    () =>
      canReadParcels ? getParcel(caseParcel.parcelId) : Promise.resolve(null),
    [caseParcel.parcelId, canReadParcels],
    canReadParcels,
  )

  const parcel = parcelQuery.data
  const canRemove =
    canManage && caseStatus === 'INITIATED' && caseParcel.surveyStatus === null
  const canAssign =
    canManage &&
    MANAGEABLE_PARCEL_STATUSES.has(caseStatus) &&
    caseParcel.surveyStatus !== 'SUBMITTED' &&
    caseParcel.surveyStatus !== 'VERIFIED'
  const surveyStatus = caseParcel.surveyStatus

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy-900">
            {parcel ? parcelIdentifier(parcel) : `Parcel ${shortId(caseParcel.parcelId)}`}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span className="font-mono">{shortId(caseParcel.parcelId)}</span>
            <CopyButton value={caseParcel.parcelId} label="parcel id" />
            <span aria-hidden="true">·</span>
            <span title={caseParcel.villageId}>
              Village {shortId(caseParcel.villageId)}
            </span>
            <span aria-hidden="true">·</span>
            <span>Identified {formatDateTime(caseParcel.identifiedAt)}</span>
          </p>

          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Area to acquire
              </dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {formatArea(caseParcel.areaToAcquireHa)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Recorded area
              </dt>
              <dd className="mt-0.5 text-slate-700">
                {parcelQuery.isLoading
                  ? 'Loading…'
                  : parcelQuery.error
                    ? 'Not available'
                    : formatArea(parcel?.areaHa ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Owners in snapshot
              </dt>
              <dd className="mt-0.5 text-slate-700">
                {caseParcel.owners.length}{' '}
                {caseParcel.owners.length === 1 ? 'owner' : 'owners'}
              </dd>
            </div>
          </dl>

          {caseParcel.owners.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                Owner IDs and shares
              </summary>
              <ul className="mt-2 space-y-1">
                {caseParcel.owners.map((owner) => (
                  <li
                    key={owner.landownerId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600"
                  >
                    <span className="flex items-center gap-1">
                      <Users aria-hidden="true" className="h-3.5 w-3.5" />
                      <span className="font-mono" title={owner.landownerId}>
                        {shortId(owner.landownerId)}
                      </span>
                      <CopyButton value={owner.landownerId} label="landowner id" />
                    </span>
                    <span>{owner.sharePercent}%</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Surveyor:</span>
            {caseParcel.assignedSurveyorUserId ? (
              <span className="font-mono" title={caseParcel.assignedSurveyorUserId}>
                {shortId(caseParcel.assignedSurveyorUserId)}
              </span>
            ) : (
              <span>Not assigned</span>
            )}
            {surveyStatus ? (
              <Badge variant={SURVEY_STATUS_VARIANTS[surveyStatus]}>
                {SURVEY_STATUS_LABELS[surveyStatus]}
              </Badge>
            ) : (
              <Badge variant="neutral">Not surveyed</Badge>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canAssign ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onAssign}
              leftIcon={<UserCheck aria-hidden="true" className="h-3.5 w-3.5" />}
            >
              {caseParcel.assignedSurveyorUserId ? 'Reassign' : 'Assign surveyor'}
            </Button>
          ) : null}
          {canRemove ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              leftIcon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {canReadParcels && parcelQuery.error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-warning-700">
          Parcel details could not be loaded. {parcelQuery.error.message}
        </p>
      ) : null}
    </li>
  )
}

function parcelIdentifier(parcel: ParcelResponse): string {
  const parts: string[] = []
  if (parcel.gatNumber) {
    parts.push(`Gat ${parcel.gatNumber}`)
  }
  if (parcel.surveyNumber) {
    parts.push(`Survey ${parcel.surveyNumber}`)
  }
  if (parcel.subdivisionNumber) {
    parts.push(`Subdivision ${parcel.subdivisionNumber}`)
  }
  return parts.length > 0 ? parts.join(' · ') : `Parcel ${shortId(parcel.id)}`
}

function IdentifyParcelDialog({
  acquisitionCase,
  refs,
  canReadParcels,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  refs: ReferenceNamesResult
  canReadParcels: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<CaseParcel>()
  const [villageId, setVillageId] = useState(acquisitionCase.villageIds[0] ?? '')
  const [parcelId, setParcelId] = useState('')
  const [area, setArea] = useState('')
  const [errors, setErrors] = useState<{
    parcelId?: string
    area?: string
  }>({})

  const parcelsQuery = useApiQuery(
    () =>
      villageId
        ? getParcels({ villageId, size: 100 })
        : Promise.resolve(null),
    [villageId],
    Boolean(villageId) && canReadParcels,
  )

  const availableParcels = (parcelsQuery.data?.content ?? []).filter(
    (parcel) => parcel.status === 'ACTIVE',
  )
  const selected = availableParcels.find((parcel) => parcel.id === parcelId)
  const recordedArea = selected?.areaHa ?? null

  function handleParcelChange(nextId: string) {
    setParcelId(nextId)
    setErrors((current) => ({ ...current, parcelId: undefined }))
    const next = availableParcels.find((parcel) => parcel.id === nextId)
    if (next && !area) {
      setArea(String(next.areaHa))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: { parcelId?: string; area?: string } = {}
    if (!parcelId) {
      nextErrors.parcelId = 'Select a parcel.'
    }
    const parsed = Number(area)
    if (!area.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      nextErrors.area = 'Enter an area greater than zero.'
    } else if (recordedArea !== null && parsed > recordedArea) {
      nextErrors.area = `The area cannot exceed the recorded area (${formatArea(recordedArea)}).`
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        identifyCaseParcel(acquisitionCase.id, { parcelId, areaToAcquireHa: parsed }),
      )
      dispatch(addToast({ variant: 'success', message: 'Parcel identified for acquisition.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="Identify an affected parcel"
      description="The owner snapshot and shares are captured by the backend when the parcel is identified."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="identify-parcel-form"
            isLoading={mutation.isLoading}
            disabled={!canReadParcels || acquisitionCase.villageIds.length === 0}
          >
            Identify parcel
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The parcel was not identified" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      {acquisitionCase.villageIds.length === 0 ? (
        <Alert variant="warning">
          Select at least one affected village before identifying parcels.
        </Alert>
      ) : !canReadParcels ? (
        <Alert variant="warning">
          Your role cannot search the land parcel register. A land records officer must identify
          parcels for this case.
        </Alert>
      ) : (
        <form id="identify-parcel-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          <Select
            label="Affected village"
            required
            value={villageId}
            onChange={(event) => {
              setVillageId(event.target.value)
              setParcelId('')
              setArea('')
            }}
          >
            {acquisitionCase.villageIds.map((id) => (
              <option key={id} value={id}>
                {refs.villageName(id) ?? shortId(id)}
              </option>
            ))}
          </Select>

          {parcelsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : parcelsQuery.error ? (
            <Alert variant="error" title="Could not load parcels">
              {parcelsQuery.error.message}
            </Alert>
          ) : availableParcels.length === 0 ? (
            <Alert variant="info">
              No active parcels are recorded in this village.{' '}
              <Link to="/land/parcels" className="font-semibold underline">
                Open the land parcel register
              </Link>
              .
            </Alert>
          ) : (
            <Select
              label="Parcel"
              required
              value={parcelId}
              onChange={(event) => handleParcelChange(event.target.value)}
              error={errors.parcelId}
              hint={
                selected
                  ? `Recorded area ${formatArea(selected.areaHa)} · ${parcelIdentifier(selected)}`
                  : 'Only active parcels in the selected village are listed.'
              }
            >
              <option value="">Select a parcel</option>
              {availableParcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {parcelIdentifier(parcel)} · {formatArea(parcel.areaHa)}
                </option>
              ))}
            </Select>
          )}

          <Input
            label="Area to acquire (ha)"
            required
            inputMode="decimal"
            value={area}
            onChange={(event) => {
              setArea(event.target.value)
              setErrors((current) => ({ ...current, area: undefined }))
            }}
            error={errors.area}
            hint={
              recordedArea !== null
                ? `Maximum ${formatArea(recordedArea)}. The backend compares the value with the recorded area.`
                : 'The area must be greater than zero.'
            }
          />
        </form>
      )}
    </Modal>
  )
}

function RemoveParcelDialog({
  acquisitionCase,
  caseParcel,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  caseParcel: CaseParcel
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<void>()

  async function remove() {
    if (mutation.isLoading) {
      return
    }

    try {
      await mutation.mutate(() => removeCaseParcel(acquisitionCase.id, caseParcel.id))
      dispatch(addToast({ variant: 'success', message: 'Parcel removed from this case.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <>
      {mutation.error ? (
        <Alert variant="error" title="The parcel was not removed" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}
      <ConfirmDialog
        title="Remove this parcel?"
        message="The parcel is released from this acquisition case. This is possible only before the survey starts and only when the parcel has no surveys."
        confirmLabel="Remove parcel"
        variant="danger"
        isLoading={mutation.isLoading}
        onConfirm={() => void remove()}
        onClose={onClose}
      />
    </>
  )
}

function AssignSurveyorDialog({
  acquisitionCase,
  caseParcel,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  caseParcel: CaseParcel
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canReadUsers = can(PERMISSION.USER_READ)
  const mutation = useApiMutation<CaseParcel>()
  const usersQuery = useApiQuery(
    () => (canReadUsers ? getUsers(0, 100) : Promise.resolve(null)),
    [canReadUsers],
    canReadUsers,
  )
  const [surveyorUserId, setSurveyorUserId] = useState(
    caseParcel.assignedSurveyorUserId ?? '',
  )
  const [error, setError] = useState<string | undefined>()

  const fieldOfficers = (usersQuery.data?.content ?? []).filter(
    (user) => user.enabled && user.roles.includes('FIELD_OFFICER'),
  )
  const usersUnavailable = canReadUsers && !usersQuery.isLoading && usersQuery.error !== null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const trimmed = surveyorUserId.trim()
    if (!trimmed) {
      setError('Enter or select the surveyor user ID.')
      return
    }
    if (!UUID_PATTERN.test(trimmed)) {
      setError('Enter a valid user UUID.')
      return
    }

    try {
      await mutation.mutate(() =>
        assignSurveyor(acquisitionCase.id, caseParcel.id, trimmed),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: 'Surveyor assigned. The field officer was notified.',
        }),
      )
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title={caseParcel.assignedSurveyorUserId ? 'Reassign surveyor' : 'Assign surveyor'}
      description="The officer must be an enabled field officer with access to the case's district. The backend checks eligibility."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="assign-surveyor-form"
            isLoading={mutation.isLoading}
          >
            Assign surveyor
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The surveyor was not assigned" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="assign-surveyor-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {canReadUsers && !usersUnavailable && fieldOfficers.length > 0 ? (
          <Select
            label="Field officer"
            value={surveyorUserId}
            onChange={(event) => {
              setSurveyorUserId(event.target.value)
              setError(undefined)
            }}
            hint="Only enabled accounts with the FIELD_OFFICER role are listed. District access is checked by the backend."
          >
            <option value="">Select a field officer</option>
            {fieldOfficers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} (@{user.username})
              </option>
            ))}
          </Select>
        ) : null}

        {canReadUsers && usersQuery.isLoading ? (
          <p className="text-xs text-slate-500">Loading field officers…</p>
        ) : null}

        {usersUnavailable ? (
          <Alert variant="warning">
            The user list could not be loaded. Paste the field officer's user UUID instead.
          </Alert>
        ) : null}

        {!canReadUsers ? (
          <Alert variant="info">
            Your role cannot list users. Paste the field officer's user UUID. The backend still
            checks that the account is an enabled field officer with district access.
          </Alert>
        ) : null}

        <Input
          label="Surveyor user ID (UUID)"
          required
          value={surveyorUserId}
          onChange={(event) => {
            setSurveyorUserId(event.target.value)
            setError(undefined)
          }}
          error={error}
          hint="Example: 3fa85f64-5717-4562-b3fc-2c963f66afa6"
        />
      </form>
    </Modal>
  )
}

function SurveyorBadgeHint() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
    </span>
  )
}

void SurveyorBadgeHint
