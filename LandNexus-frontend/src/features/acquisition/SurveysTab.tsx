import { useState, type FormEvent } from 'react'
import { ShieldCheck, XCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  getCaseParcels,
  getCaseSurveys,
  rejectSurvey,
  verifySurvey,
} from '../../api/acquisition'
import type {
  CaseParcel,
  CaseResponse,
  SurveyResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatArea, formatDate, formatDateTime, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import {
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_VARIANTS,
  formatGps,
  variancePercent,
} from './labels'

export function SurveysTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const { can, user } = useAuth()
  const refs = useReferenceNames()
  const [decision, setDecision] = useState<{
    survey: SurveyResponse
    outcome: 'VERIFIED' | 'REJECTED'
  } | null>(null)

  const surveysQuery = useApiQuery(
    () => getCaseSurveys(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )
  const parcelsQuery = useApiQuery(
    () => getCaseParcels(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  const canVerifyStage =
    can(PERMISSION.SURVEY_VERIFY) &&
    acquisitionCase.status === 'SURVEY_IN_PROGRESS'

  const parcels = parcelsQuery.data ?? []
  const parcelById = new Map<string, CaseParcel>(
    parcels.map((caseParcel) => [caseParcel.id, caseParcel]),
  )
  const surveys = (surveysQuery.data ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function canDecide(survey: SurveyResponse): boolean {
    return (
      canVerifyStage &&
      survey.status === 'SUBMITTED' &&
      survey.surveyorUsername !== user?.username
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Field surveys"
          description="Measurements are recorded by the assigned field officer. The surveyor cannot verify their own survey."
          action={
            acquisitionCase.status === 'SURVEY_IN_PROGRESS' ? (
              <Badge variant="info">Verification open</Badge>
            ) : (
              <Badge variant="neutral">Read only in this stage</Badge>
            )
          }
        />
        <Alert variant="info" className="mt-4">
          The backend fixes the variance calculation and requires field notes when the measured
          area differs from the recorded area by more than 10%. Rejecting a survey always needs
          remarks.
        </Alert>
      </Card>

      {surveysQuery.error ? (
        <Card>
          <ErrorState
            title="Could not load surveys"
            message={surveysQuery.error.message}
            onRetry={surveysQuery.reload}
          />
        </Card>
      ) : surveysQuery.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </Card>
      ) : surveys.length === 0 ? (
        <Card>
          <EmptyState
            title="No surveys recorded yet"
            description={
              acquisitionCase.status === 'SURVEY_IN_PROGRESS'
                ? 'An assigned field officer can record the survey from “My surveys”.'
                : 'Surveys appear here once field work starts.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {surveys.map((survey) => {
            const caseParcel = parcelById.get(survey.caseParcelId)
            const variance = variancePercent(
              survey.measuredAreaHa,
              survey.recordedAreaHa,
            )
            const largeVariance = variance !== null && Math.abs(variance) > 10
            const ownSurvey = survey.surveyorUsername === user?.username

            return (
              <Card key={survey.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-navy-900">
                        Survey by {survey.surveyorUsername}
                      </h3>
                      <Badge variant={SURVEY_STATUS_VARIANTS[survey.status]}>
                        {SURVEY_STATUS_LABELS[survey.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Surveyed {formatDate(survey.surveyedOn)} · submitted{' '}
                      {formatDateTime(survey.createdAt)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <span>
                        Affected parcel{' '}
                        <span className="font-mono" title={survey.caseParcelId}>
                          {shortId(survey.caseParcelId)}
                        </span>
                      </span>
                      {caseParcel ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span title={caseParcel.villageId}>
                            {refs.villageName(caseParcel.villageId) ??
                              `Village ${shortId(caseParcel.villageId)}`}
                          </span>
                        </>
                      ) : null}
                    </p>

                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Measured area
                        </dt>
                        <dd className="mt-0.5 font-medium text-slate-800">
                          {formatArea(survey.measuredAreaHa)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Recorded area
                        </dt>
                        <dd className="mt-0.5 text-slate-700">
                          {formatArea(survey.recordedAreaHa)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Variance
                        </dt>
                        <dd className="mt-0.5">
                          <Badge variant={largeVariance ? 'warning' : 'neutral'}>
                            {variance === null ? '—' : `${variance.toFixed(2)}%`}
                          </Badge>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          GPS point
                        </dt>
                        <dd className="mt-0.5 font-mono text-xs text-slate-700">
                          {formatGps(survey.gpsLatitude, survey.gpsLongitude)}
                        </dd>
                      </div>
                    </dl>

                    {survey.fieldNotes ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-semibold">Field notes:</span>{' '}
                        {survey.fieldNotes}
                      </p>
                    ) : null}

                    {survey.verifiedAt || survey.verificationRemarks ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Decision {formatDateTime(survey.verifiedAt)}
                        {survey.verificationRemarks
                          ? ` · ${survey.verificationRemarks}`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canDecide(survey) ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDecision({ survey, outcome: 'VERIFIED' })
                          }
                          leftIcon={
                            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                          }
                        >
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDecision({ survey, outcome: 'REJECTED' })
                          }
                          leftIcon={
                            <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                          }
                        >
                          Reject
                        </Button>
                      </>
                    ) : ownSurvey && survey.status === 'SUBMITTED' ? (
                      <span className="self-center text-xs text-slate-500">
                        You recorded this survey; another officer must verify it.
                      </span>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {decision ? (
        <SurveyDecisionDialog
          acquisitionCase={acquisitionCase}
          survey={decision.survey}
          outcome={decision.outcome}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null)
            surveysQuery.reload()
          }}
        />
      ) : null}
    </div>
  )
}

function SurveyDecisionDialog({
  acquisitionCase,
  survey,
  outcome,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  survey: SurveyResponse
  outcome: 'VERIFIED' | 'REJECTED'
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<SurveyResponse>()
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | undefined>()
  const rejecting = outcome === 'REJECTED'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const trimmed = remarks.trim()
    if (rejecting && !trimmed) {
      setError('Remarks are required when rejecting a survey.')
      return
    }
    if (trimmed.length > 500) {
      setError('Use at most 500 characters.')
      return
    }

    try {
      await mutation.mutate(() =>
        rejecting
          ? rejectSurvey(acquisitionCase.id, survey.id, trimmed)
          : verifySurvey(acquisitionCase.id, survey.id, trimmed || undefined),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: rejecting ? 'Survey rejected.' : 'Survey verified.',
        }),
      )
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title={rejecting ? 'Reject survey' : 'Verify survey'}
      description={`${survey.surveyorUsername} · measured ${formatArea(survey.measuredAreaHa)} on ${formatDate(survey.surveyedOn)}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="survey-decision-form"
            variant={rejecting ? 'danger' : 'primary'}
            isLoading={mutation.isLoading}
          >
            {rejecting ? 'Reject' : 'Verify'}
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The decision was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="survey-decision-form" onSubmit={handleSubmit} noValidate>
        <Textarea
          label={rejecting ? 'Remarks (required)' : 'Remarks (optional)'}
          value={remarks}
          rows={4}
          maxLength={500}
          onChange={(event) => {
            setRemarks(event.target.value)
            setError(undefined)
          }}
          error={error}
          hint={`${remarks.length}/500 characters`}
        />
      </form>
    </Modal>
  )
}
