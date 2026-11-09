import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, LocateFixed, MapPin } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { getCase, getCaseParcels, submitSurvey } from '../../api/acquisition'
import { getParcel } from '../../api/landRecords'
import type {
  CaseParcel,
  CaseResponse,
  ParcelResponse,
  SurveyResponse,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatArea, formatDate, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { todayIso, isFutureDate } from './dates'
import {
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_VARIANTS,
  formatGps,
  isInsideIndia,
  variancePercent,
  varianceWarning,
} from './labels'
import { SurveyPhotosPanel } from './SurveyPhotosPanel'

const FIELD_NOTES_LIMIT = 2_000

interface SurveyFormErrors {
  surveyedOn?: string
  measuredAreaHa?: string
  gpsLatitude?: string
  gpsLongitude?: string
  fieldNotes?: string
}

export function SurveyFormPage() {
  const { id, caseParcelId } = useParams<{ id: string; caseParcelId: string }>()
  const { user } = useAuth()

  const caseQuery = useApiQuery<CaseResponse | null>(
    () => (id ? getCase(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )
  const parcelsQuery = useApiQuery<CaseParcel[]>(
    () => (id ? getCaseParcels(id) : Promise.resolve([])),
    [id],
    Boolean(id),
  )

  const acquisitionCase = caseQuery.data
  const caseParcel =
    (parcelsQuery.data ?? []).find((row) => row.id === caseParcelId) ?? null
  const canReadParcels = user ? hasPermission(user, PERMISSION.LAND_RECORD_READ) : false

  const parcelQuery = useApiQuery<ParcelResponse | null>(
    () =>
      canReadParcels && caseParcel
        ? getParcel(caseParcel.parcelId)
        : Promise.resolve(null),
    [caseParcel?.parcelId, canReadParcels],
    canReadParcels && Boolean(caseParcel),
  )

  if (caseQuery.isLoading || parcelsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (caseQuery.error) {
    return (
      <>
        <PageHeader
          eyebrow="Module 4 · Land acquisition"
          title="Record a survey"
          description="The acquisition case could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              caseQuery.error.status === 404
                ? 'Case not found'
                : caseQuery.error.status === 403
                  ? 'You do not have access'
                  : 'Could not load the acquisition case'
            }
            message={caseQuery.error.message}
            onRetry={caseQuery.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/acquisition/my-surveys" variant="outline">
              Back to my surveys
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  if (!acquisitionCase) {
    return (
      <>
        <PageHeader eyebrow="Module 4 · Land acquisition" title="Record a survey" />
        <Card>
          <ErrorState
            title="Case not found"
            message="It may not exist, or it may be outside the districts you can see."
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/acquisition/my-surveys" variant="outline">
              Back to my surveys
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Land acquisition"
        title="Record a field survey"
        description={`${acquisitionCase.caseNumber} · measurement, GPS point and field notes for one affected parcel.`}
        actions={
          <LinkButton
            to="/acquisition/my-surveys"
            variant="outline"
            leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
          >
            My surveys
          </LinkButton>
        }
      />

      {parcelsQuery.error ? (
        <Alert variant="error" title="The affected parcels could not be loaded" className="mb-4">
          {parcelsQuery.error.message}
        </Alert>
      ) : null}

      {!caseParcel ? (
        <Card>
          <ErrorState
            title="Affected parcel not found"
            message="The parcel is not part of this case, or it has been released."
          />
          <div className="flex justify-center pb-6">
            <Link
              to={`/acquisition/${acquisitionCase.id}`}
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Open the case record
            </Link>
          </div>
        </Card>
      ) : (
        <SurveyForm
          acquisitionCase={acquisitionCase}
          caseParcel={caseParcel}
          parcel={parcelQuery.data}
          parcelLoading={parcelQuery.isLoading}
          parcelError={parcelQuery.error?.message ?? null}
          currentUserId={user?.id ?? null}
        />
      )}
    </>
  )
}

function hasPermission(
  user: { permissions: string[] },
  permission: string,
): boolean {
  return user.permissions.includes(permission)
}

function SurveyForm({
  acquisitionCase,
  caseParcel,
  parcel,
  parcelLoading,
  parcelError,
  currentUserId,
}: {
  acquisitionCase: CaseResponse
  caseParcel: CaseParcel
  parcel: ParcelResponse | null
  parcelLoading: boolean
  parcelError: string | null
  currentUserId: string | null
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<SurveyResponse>()
  const [surveyedOn, setSurveyedOn] = useState(todayIso())
  const [measuredArea, setMeasuredArea] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [fieldNotes, setFieldNotes] = useState('')
  const [errors, setErrors] = useState<SurveyFormErrors>({})
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [createdSurvey, setCreatedSurvey] = useState<SurveyResponse | null>(null)

  const recordedArea = parcel?.areaHa ?? null
  const measured = Number(measuredArea)
  const variance =
    recordedArea !== null && measuredArea.trim() !== '' && Number.isFinite(measured)
      ? variancePercent(measured, recordedArea)
      : null
  const warning =
    recordedArea !== null && measuredArea.trim() !== '' && Number.isFinite(measured)
      ? varianceWarning(measured, recordedArea)
      : null

  const blockedReason = surveyBlockedReason(
    acquisitionCase.status,
    caseParcel,
    currentUserId,
  )

  function useMyLocation() {
    setLocationError(null)
    if (!('geolocation' in navigator)) {
      setLocationError('This browser does not provide a location.')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude))
        setLongitude(String(position.coords.longitude))
        setLocating(false)
        setErrors((current) => ({
          ...current,
          gpsLatitude: undefined,
          gpsLongitude: undefined,
        }))
      },
      (error) => {
        setLocating(false)
        setLocationError(
          error.message
            ? `The location could not be read: ${error.message}`
            : 'The location could not be read. Enter the GPS point manually.',
        )
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading || blockedReason) {
      return
    }

    const nextErrors: SurveyFormErrors = {}
    if (!surveyedOn) {
      nextErrors.surveyedOn = 'Choose the survey date.'
    } else if (isFutureDate(surveyedOn)) {
      nextErrors.surveyedOn = 'The survey date cannot be in the future.'
    }

    const parsedMeasured = Number(measuredArea)
    if (!measuredArea.trim() || !Number.isFinite(parsedMeasured) || parsedMeasured <= 0) {
      nextErrors.measuredAreaHa = 'Enter a measured area greater than zero.'
    }

    const parsedLatitude = Number(latitude)
    const parsedLongitude = Number(longitude)
    if (!latitude.trim() || !Number.isFinite(parsedLatitude)) {
      nextErrors.gpsLatitude = 'Enter a numeric latitude.'
    }
    if (!longitude.trim() || !Number.isFinite(parsedLongitude)) {
      nextErrors.gpsLongitude = 'Enter a numeric longitude.'
    }
    if (
      !nextErrors.gpsLatitude &&
      !nextErrors.gpsLongitude &&
      !isInsideIndia(parsedLatitude, parsedLongitude)
    ) {
      nextErrors.gpsLatitude = 'The GPS point must be inside India.'
      nextErrors.gpsLongitude = 'Check that latitude and longitude are not swapped.'
    }

    const trimmedNotes = fieldNotes.trim()
    if (trimmedNotes.length > FIELD_NOTES_LIMIT) {
      nextErrors.fieldNotes = `Use at most ${FIELD_NOTES_LIMIT} characters.`
    } else if (warning && !trimmedNotes) {
      nextErrors.fieldNotes =
        'Field notes are required because the measured area differs by more than 10%.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      const survey = await mutation.mutate(() =>
        submitSurvey(acquisitionCase.id, caseParcel.id, {
          surveyedOn,
          measuredAreaHa: parsedMeasured,
          gpsLatitude: parsedLatitude,
          gpsLongitude: parsedLongitude,
          fieldNotes: trimmedNotes || null,
        }),
      )
      setCreatedSurvey(survey)
      dispatch(
        addToast({
          variant: 'success',
          message: 'Survey submitted for verification. You can add photos now.',
        }),
      )
    } catch {
      // The mutation keeps the backend message; the form stays filled in.
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Survey details"
          description="The backend computes the variance against the recorded parcel area. Field notes are required above 10%."
          action={
            <Badge variant={SURVEY_STATUS_VARIANTS[caseParcel.surveyStatus ?? 'SUBMITTED']}>
              {caseParcel.surveyStatus
                ? SURVEY_STATUS_LABELS[caseParcel.surveyStatus]
                : 'Not surveyed'}
            </Badge>
          }
        />

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Case">{acquisitionCase.caseNumber}</Detail>
          <Detail label="Affected parcel">{shortId(caseParcel.parcelId)}</Detail>
          <Detail label="Area to acquire">
            {formatArea(caseParcel.areaToAcquireHa)}
          </Detail>
          <Detail label="Recorded area">
            {parcelLoading
              ? 'Loading…'
              : parcelError
                ? 'Not available'
                : formatArea(recordedArea)}
          </Detail>
        </dl>

        <p className="mt-3 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
          <span>GPS coordinates are stored only with this survey.</span>
        </p>

        {parcelError ? (
          <Alert variant="warning" className="mt-3">
            The recorded area could not be loaded, so the variance cannot be previewed here. The
            backend still compares the measured area with the recorded area.
          </Alert>
        ) : null}
      </Card>

      {blockedReason ? (
        <Card>
          <Alert variant="warning" title="This parcel cannot be surveyed now">
            {blockedReason}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton
              to={`/acquisition/${acquisitionCase.id}`}
              variant="outline"
            >
              Open the case record
            </LinkButton>
            <LinkButton to="/acquisition/my-surveys" variant="ghost">
              My surveys
            </LinkButton>
          </div>
        </Card>
      ) : createdSurvey ? (
        <>
          <Alert variant="success" title="Survey submitted">
            The survey was recorded on {formatDate(createdSurvey.surveyedOn)} and is awaiting
            verification. Photos can be added while it is in that state.
          </Alert>

          <SurveyPhotosPanel
            caseId={acquisitionCase.id}
            surveyId={createdSurvey.id}
            caseStatus={acquisitionCase.status}
            surveyStatus={createdSurvey.status}
            defaultGps={{
              latitude: createdSurvey.gpsLatitude,
              longitude: createdSurvey.gpsLongitude,
            }}
          />

          <div className="flex flex-wrap gap-2">
            <LinkButton to={`/acquisition/${acquisitionCase.id}`}>
              Back to the case
            </LinkButton>
            <LinkButton to="/acquisition/my-surveys" variant="outline">
              My surveys
            </LinkButton>
          </div>
        </>
      ) : (
        <>
          {mutation.error ? (
            <Alert variant="error" title="The survey was not submitted">
              {mutation.error.message}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <Card className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Survey date"
                  type="date"
                  required
                  max={todayIso()}
                  value={surveyedOn}
                  onChange={(event) => {
                    setSurveyedOn(event.target.value)
                    setErrors((current) => ({ ...current, surveyedOn: undefined }))
                  }}
                  error={errors.surveyedOn}
                  hint="The survey date cannot be in the future."
                />

                <Input
                  label="Measured area (ha)"
                  required
                  inputMode="decimal"
                  value={measuredArea}
                  onChange={(event) => {
                    setMeasuredArea(event.target.value)
                    setErrors((current) => ({
                      ...current,
                      measuredAreaHa: undefined,
                      fieldNotes: undefined,
                    }))
                  }}
                  error={errors.measuredAreaHa}
                  hint={
                    recordedArea !== null
                      ? `Recorded area ${formatArea(recordedArea)}. Variance is calculated by the backend.`
                      : 'The area must be greater than zero.'
                  }
                />
              </div>

              {variance !== null ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">Variance</span>
                  <Badge variant={Math.abs(variance) > 10 ? 'warning' : 'neutral'}>
                    {variance.toFixed(2)}%
                  </Badge>
                  <span className="text-xs text-slate-500">
                    measured {formatArea(measured)} · recorded {formatArea(recordedArea)}
                  </span>
                </div>
              ) : null}

              {warning ? (
                <Alert variant="warning" className="mt-3">
                  {warning}
                </Alert>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input
                  label="GPS latitude"
                  required
                  inputMode="decimal"
                  value={latitude}
                  onChange={(event) => {
                    setLatitude(event.target.value)
                    setErrors((current) => ({
                      ...current,
                      gpsLatitude: undefined,
                      gpsLongitude: undefined,
                    }))
                  }}
                  error={errors.gpsLatitude}
                  hint="Decimal degrees, inside India."
                />
                <Input
                  label="GPS longitude"
                  required
                  inputMode="decimal"
                  value={longitude}
                  onChange={(event) => {
                    setLongitude(event.target.value)
                    setErrors((current) => ({
                      ...current,
                      gpsLongitude: undefined,
                      gpsLatitude: undefined,
                    }))
                  }}
                  error={errors.gpsLongitude}
                  hint="Decimal degrees, inside India."
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={useMyLocation}
                  isLoading={locating}
                  disabled={locating}
                  leftIcon={<LocateFixed aria-hidden="true" className="h-4 w-4" />}
                >
                  Use my location
                </Button>
                <p className="text-xs text-slate-500">
                  The browser asks for permission only after you press this button. You can
                  always enter the GPS point manually.
                </p>
              </div>

              {locationError ? (
                <Alert variant="warning" className="mt-3">
                  {locationError}
                </Alert>
              ) : null}

              <div className="mt-4">
                <Textarea
                  label={warning ? 'Field notes (required)' : 'Field notes (optional)'}
                  value={fieldNotes}
                  rows={5}
                  maxLength={FIELD_NOTES_LIMIT}
                  onChange={(event) => {
                    setFieldNotes(event.target.value)
                    setErrors((current) => ({ ...current, fieldNotes: undefined }))
                  }}
                  error={errors.fieldNotes}
                  hint={`${fieldNotes.length}/${FIELD_NOTES_LIMIT} characters. Required when the variance is above 10%.`}
                />
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                GPS point to submit:{' '}
                <span className="font-mono">
                  {formatGps(
                    Number.isFinite(Number(latitude)) && latitude.trim() !== ''
                      ? Number(latitude)
                      : null,
                    Number.isFinite(Number(longitude)) && longitude.trim() !== ''
                      ? Number(longitude)
                      : null,
                  )}
                </span>
              </div>
            </Card>

            <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-card backdrop-blur">
              <p className="text-xs text-slate-500">
                Submitting moves the parcel to awaiting verification. A scrutiny officer must
                decide it.
              </p>
              <div className="flex gap-2">
                <LinkButton to="/acquisition/my-surveys" variant="outline">
                  Cancel
                </LinkButton>
                <Button type="submit" isLoading={mutation.isLoading}>
                  Submit survey
                </Button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  )
}

function surveyBlockedReason(
  caseStatus: CaseResponse['status'],
  caseParcel: CaseParcel,
  currentUserId: string | null,
): string | null {
  if (caseStatus !== 'SURVEY_IN_PROGRESS') {
    return 'Surveys can be recorded only while the case is Survey in progress.'
  }
  if (!currentUserId || caseParcel.assignedSurveyorUserId !== currentUserId) {
    return 'This parcel is not assigned to you. Only the assigned field officer can record the survey.'
  }
  if (caseParcel.surveyStatus === 'SUBMITTED') {
    return 'This parcel already has a survey awaiting verification.'
  }
  if (caseParcel.surveyStatus === 'VERIFIED') {
    return 'This parcel already has a verified survey.'
  }
  return null
}
