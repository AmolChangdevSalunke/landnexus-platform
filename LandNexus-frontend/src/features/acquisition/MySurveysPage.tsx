import { Link } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, MapPinned } from 'lucide-react'
import { getMyAssignments } from '../../api/acquisition'
import { getParcel } from '../../api/landRecords'
import type { CaseParcel, ParcelResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatArea, formatDateTime, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { SURVEY_STATUS_LABELS, SURVEY_STATUS_VARIANTS } from './labels'

export function MySurveysPage() {
  const { can } = useAuth()
  const canReadParcels = can(PERMISSION.LAND_RECORD_READ)
  const canReadCase = can(PERMISSION.ACQUISITION_READ)

  const query = useApiQuery(() => getMyAssignments(), [])

  const assignments = (query.data ?? [])
    .slice()
    .sort((a, b) => a.identifiedAt.localeCompare(b.identifiedAt))

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Land acquisition"
        title="My surveys"
        description="Parcels assigned to you while their acquisition case is in the survey stage. Only the assigned field officer can record the survey."
        actions={
          canReadCase ? (
            <LinkButton to="/acquisition" variant="outline" leftIcon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}>
              Acquisition cases
            </LinkButton>
          ) : null
        }
      />

      <Alert variant="info" className="mb-4">
        The list comes from the backend worklist. A parcel disappears when the case leaves the
        survey stage. A survey awaiting verification or already verified cannot be submitted
        again; a rejected survey can be recorded again.
      </Alert>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 403
                ? 'You do not have survey access'
                : 'Could not load your assignments'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : query.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : assignments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck aria-hidden="true" className="h-6 w-6" />}
            title="No surveys assigned to you"
            description="An acquisition officer assigns parcels to field officers while a case is in the survey stage."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              canReadParcels={canReadParcels}
              canReadCase={canReadCase}
            />
          ))}
        </div>
      )}
    </>
  )
}

function AssignmentCard({
  assignment,
  canReadParcels,
  canReadCase,
}: {
  assignment: CaseParcel
  canReadParcels: boolean
  canReadCase: boolean
}) {
  const refs = useReferenceNames()
  const parcelQuery = useApiQuery<ParcelResponse | null>(
    () =>
      canReadParcels ? getParcel(assignment.parcelId) : Promise.resolve(null),
    [assignment.parcelId, canReadParcels],
    canReadParcels,
  )

  const parcel = parcelQuery.data
  const status = assignment.surveyStatus
  const canSubmit = status === null || status === 'REJECTED'

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-navy-900">
              {parcel ? parcelIdentifier(parcel) : `Parcel ${shortId(assignment.parcelId)}`}
            </h2>
            {status ? (
              <Badge variant={SURVEY_STATUS_VARIANTS[status]}>
                {SURVEY_STATUS_LABELS[status]}
              </Badge>
            ) : (
              <Badge variant="neutral">Not surveyed</Badge>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span className="font-mono" title={assignment.parcelId}>
              {shortId(assignment.parcelId)}
            </span>
            <span aria-hidden="true">·</span>
            <span title={assignment.villageId}>
              {refs.villageName(assignment.villageId) ??
                `Village ${shortId(assignment.villageId)}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>Identified {formatDateTime(assignment.identifiedAt)}</span>
          </p>

          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Area to acquire
              </dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {formatArea(assignment.areaToAcquireHa)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <MapPinned aria-hidden="true" className="h-3 w-3" />
                Recorded area
              </dt>
              <dd className="mt-0.5 text-slate-700">
                {!canReadParcels
                  ? 'Not available to your role'
                  : parcelQuery.isLoading
                    ? 'Loading…'
                    : parcelQuery.error
                      ? 'Not available'
                      : formatArea(parcel?.areaHa ?? null)}
              </dd>
            </div>
          </dl>

          {!canReadParcels ? (
            <p className="mt-2 text-xs text-slate-500">
              Land parcel records are not readable by your role, so the recorded area is not
              shown here. The backend still compares the measured area with the recorded area.
            </p>
          ) : null}

          {canReadParcels && parcelQuery.error ? (
            <p role="alert" className="mt-2 text-xs font-medium text-warning-700">
              The parcel record could not be loaded. {parcelQuery.error.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          {canSubmit ? (
            <LinkButton
              to={`/acquisition/${assignment.caseId}/surveys/${assignment.id}/new`}
              size="sm"
            >
              {status === 'REJECTED' ? 'Record survey again' : 'Record survey'}
            </LinkButton>
          ) : (
            <span className="max-w-48 text-right text-xs text-slate-500">
              {status === 'SUBMITTED'
                ? 'Awaiting verification. Another officer must decide it.'
                : 'Verified. No further survey is needed.'}
            </span>
          )}

          {canReadCase ? (
            <Link
              to={`/acquisition/${assignment.caseId}`}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Open case {shortId(assignment.caseId)}
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
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
