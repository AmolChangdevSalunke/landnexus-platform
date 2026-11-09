import { useState, type FormEvent } from 'react'
import { PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  getAward,
  getCaseParcels,
  getPossessions,
  recordPossession,
} from '../../api/acquisition'
import { toApiErrorInfo } from '../../api/errors'
import type {
  AwardResponse,
  CaseParcel,
  CaseResponse,
  PossessionResponse,
  PossessionType,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatArea, formatDate, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { isFutureDate, todayIso } from './dates'
import { POSSESSION_TYPE_LABELS } from './labels'

const POSSESSION_TYPES = Object.keys(POSSESSION_TYPE_LABELS) as PossessionType[]
const REMARKS_LIMIT = 500

function loadAward(caseId: string): Promise<AwardResponse | null> {
  return getAward(caseId).catch((caught: unknown) => {
    if (toApiErrorInfo(caught).status === 404) {
      return null
    }
    throw caught
  })
}

export function PossessionTab({
  acquisitionCase,
  reloadKey,
  onChanged,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
  onChanged: () => void
}) {
  const { can } = useAuth()
  const refs = useReferenceNames()
  const [recordOpen, setRecordOpen] = useState(false)

  const possessionsQuery = useApiQuery(
    () => getPossessions(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )
  const parcelsQuery = useApiQuery(
    () => getCaseParcels(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )
  const awardQuery = useApiQuery<AwardResponse | null>(
    () => loadAward(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  const possessions = (possessionsQuery.data ?? [])
    .slice()
    .sort((a, b) => b.possessionDate.localeCompare(a.possessionDate))
  const parcels = parcelsQuery.data ?? []
  const award = awardQuery.data
  const recordedIds = new Set(possessions.map((possession) => possession.caseParcelId))
  const unrecorded = parcels.filter((caseParcel) => !recordedIds.has(caseParcel.id))

  const parcelById = new Map<string, CaseParcel>(
    parcels.map((caseParcel) => [caseParcel.id, caseParcel]),
  )

  const canRecord =
    can(PERMISSION.ACQUISITION_MANAGE) &&
    acquisitionCase.status === 'AWARD_DECLARED' &&
    award !== null &&
    unrecorded.length > 0

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Possession"
          description="Possession is recorded per affected parcel after the award is declared. Every parcel needs a record before possession can be completed."
          action={
            canRecord ? (
              <Button
                onClick={() => setRecordOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Record possession
              </Button>
            ) : null
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant={unrecorded.length === 0 && parcels.length > 0 ? 'success' : 'neutral'}>
            {possessions.length}/{parcels.length} parcels recorded
          </Badge>
          {award ? (
            <span className="text-xs text-slate-500">
              Award {award.awardNumber} · declared {formatDate(award.awardDate)}
            </span>
          ) : null}
        </div>

        <Alert variant="info" className="mt-4">
          Recording possession is separate from completing the stage. When every parcel has a
          record, use <span className="font-semibold">Complete possession</span> in the workflow
          actions above.
        </Alert>

        {acquisitionCase.status !== 'AWARD_DECLARED' && acquisitionCase.status !== 'POSSESSION_TAKEN' ? (
          <Alert variant="warning" className="mt-3">
            Possession can be recorded only while the case is Award declared. The backend enforces
            the same rule.
          </Alert>
        ) : null}

        {awardQuery.error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-warning-700">
            The award could not be loaded, so the earliest possession date cannot be shown. (
            {awardQuery.error.message})
          </p>
        ) : null}
      </Card>

      {possessionsQuery.error ? (
        <Card>
          <ErrorState
            title="Could not load possession records"
            message={possessionsQuery.error.message}
            onRetry={possessionsQuery.reload}
          />
        </Card>
      ) : possessionsQuery.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : possessions.length === 0 ? (
        <Card>
          <EmptyState
            title="No possession recorded yet"
            description={
              canRecord
                ? 'Record physical or deemed possession for each affected parcel.'
                : 'Possession records appear here after an authorised officer records them.'
            }
            action={
              canRecord ? (
                <Button variant="outline" onClick={() => setRecordOpen(true)}>
                  Record possession
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {possessions.map((possession) => {
            const caseParcel = parcelById.get(possession.caseParcelId)
            return (
              <Card key={possession.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-navy-900">
                        {POSSESSION_TYPE_LABELS[possession.possessionType]}
                      </h3>
                      <Badge variant="success">Recorded</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      Possession date {formatDate(possession.possessionDate)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <span>Affected parcel</span>
                      <span className="font-mono" title={possession.caseParcelId}>
                        {shortId(possession.caseParcelId)}
                      </span>
                      <CopyButton value={possession.caseParcelId} label="case parcel id" />
                      {caseParcel ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span title={caseParcel.parcelId}>
                            Parcel {shortId(caseParcel.parcelId)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span title={caseParcel.villageId}>
                            {refs.villageName(caseParcel.villageId) ??
                              `Village ${shortId(caseParcel.villageId)}`}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatArea(caseParcel.areaToAcquireHa)}</span>
                        </>
                      ) : null}
                    </p>
                    {possession.remarks ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {possession.remarks}
                      </p>
                    ) : null}
                    <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <span>Recorded by user</span>
                      <span className="font-mono" title={possession.recordedByUserId}>
                        {shortId(possession.recordedByUserId)}
                      </span>
                      <CopyButton value={possession.recordedByUserId} label="recording user id" />
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {recordOpen && award ? (
        <RecordPossessionDialog
          acquisitionCase={acquisitionCase}
          award={award}
          parcels={unrecorded}
          parcelsLoading={parcelsQuery.isLoading}
          onClose={() => setRecordOpen(false)}
          onSaved={() => {
            setRecordOpen(false)
            possessionsQuery.reload()
            parcelsQuery.reload()
            onChanged()
          }}
        />
      ) : null}
    </div>
  )
}

function RecordPossessionDialog({
  acquisitionCase,
  award,
  parcels,
  parcelsLoading,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  award: AwardResponse
  parcels: CaseParcel[]
  parcelsLoading: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<PossessionResponse>()
  const [caseParcelId, setCaseParcelId] = useState(parcels[0]?.id ?? '')
  const [possessionDate, setPossessionDate] = useState(todayIso())
  const [possessionType, setPossessionType] = useState<PossessionType>('PHYSICAL')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<{
    caseParcelId?: string
    possessionDate?: string
    remarks?: string
  }>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: typeof errors = {}
    if (!caseParcelId) {
      nextErrors.caseParcelId = 'Select the affected parcel.'
    }
    if (!possessionDate) {
      nextErrors.possessionDate = 'Choose the possession date.'
    } else if (isFutureDate(possessionDate)) {
      nextErrors.possessionDate = 'The possession date cannot be in the future.'
    } else if (possessionDate < award.awardDate) {
      nextErrors.possessionDate = `Possession cannot be taken before the award date (${formatDate(
        award.awardDate,
      )}).`
    }
    if (remarks.trim().length > REMARKS_LIMIT) {
      nextErrors.remarks = `Use at most ${REMARKS_LIMIT} characters.`
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        recordPossession(acquisitionCase.id, {
          caseParcelId,
          possessionDate,
          possessionType,
          remarks: remarks.trim() || null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Possession recorded.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="Record possession"
      description="One possession record per affected parcel. The award date is the earliest allowed date."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="record-possession-form"
            isLoading={mutation.isLoading}
            disabled={mutation.isLoading || parcels.length === 0}
          >
            Record possession
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="Possession was not recorded" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="record-possession-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Select
          label="Affected parcel"
          required
          value={caseParcelId}
          onChange={(event) => {
            setCaseParcelId(event.target.value)
            setErrors((current) => ({ ...current, caseParcelId: undefined }))
          }}
          error={errors.caseParcelId}
          disabled={parcelsLoading || parcels.length === 0}
          hint={
            parcelsLoading
              ? 'Loading affected parcels…'
              : parcels.length === 0
                ? 'Every affected parcel already has a possession record.'
                : 'Only parcels without a possession record are listed.'
          }
        >
          <option value="">Select a parcel</option>
          {parcels.map((caseParcel) => (
            <option key={caseParcel.id} value={caseParcel.id}>
              {shortId(caseParcel.parcelId)} · {formatArea(caseParcel.areaToAcquireHa)}
            </option>
          ))}
        </Select>

        <Input
          label="Possession date"
          type="date"
          required
          min={award.awardDate}
          max={todayIso()}
          value={possessionDate}
          onChange={(event) => {
            setPossessionDate(event.target.value)
            setErrors((current) => ({ ...current, possessionDate: undefined }))
          }}
          error={errors.possessionDate}
          hint={`On or after the award date (${formatDate(award.awardDate)}) and not in the future.`}
        />

        <Select
          label="Possession type"
          required
          value={possessionType}
          onChange={(event) => setPossessionType(event.target.value as PossessionType)}
        >
          {POSSESSION_TYPES.map((type) => (
            <option key={type} value={type}>
              {POSSESSION_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>

        <Textarea
          label="Remarks (optional)"
          value={remarks}
          rows={4}
          maxLength={REMARKS_LIMIT}
          onChange={(event) => {
            setRemarks(event.target.value)
            setErrors((current) => ({ ...current, remarks: undefined }))
          }}
          error={errors.remarks}
          hint={`${remarks.length}/${REMARKS_LIMIT} characters.`}
        />
      </form>
    </Modal>
  )
}
