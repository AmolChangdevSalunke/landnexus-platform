import { useState, type FormEvent } from 'react'
import { PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  decideObjection,
  getCaseParcels,
  getNotices,
  getObjections,
  registerObjection,
} from '../../api/acquisition'
import type {
  CaseParcel,
  CaseResponse,
  NoticeResponse,
  ObjectionResponse,
  ObjectionStatus,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
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
import { formatDate, formatDateTime, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { isFutureDate, todayIso } from './dates'
import {
  OBJECTION_STATUS_LABELS,
  OBJECTION_STATUS_VARIANTS,
} from './labels'

export function ObjectionsTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const { can, user } = useAuth()
  const refs = useReferenceNames()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [decision, setDecision] = useState<ObjectionResponse | null>(null)

  const objectionsQuery = useApiQuery(
    () => getObjections(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )
  const parcelsQuery = useApiQuery(
    () => getCaseParcels(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )
  const noticesQuery = useApiQuery(
    () => getNotices(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  const canManage = can(PERMISSION.ACQUISITION_MANAGE)
  const canDecideStage =
    can(PERMISSION.ACQUISITION_DECIDE) &&
    acquisitionCase.status === 'NOTIFICATION_ISSUED'
  const canRegister =
    canManage && acquisitionCase.status === 'NOTIFICATION_ISSUED'

  const parcels = parcelsQuery.data ?? []
  const parcelById = new Map<string, CaseParcel>(
    parcels.map((caseParcel) => [caseParcel.id, caseParcel]),
  )
  const preliminaryNotice = latestPreliminaryNotice(noticesQuery.data ?? [])
  const objections = objectionsQuery.data ?? []

  function canDecide(objection: ObjectionResponse): boolean {
    return (
      canDecideStage &&
      objection.status === 'OPEN' &&
      objection.registeredByUserId !== user?.id
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Objections"
          description="An objection is registered against an affected parcel during the published objection period."
          action={
            canRegister ? (
              <Button
                onClick={() => setRegisterOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Register objection
              </Button>
            ) : null
          }
        />
        <Alert variant="info" className="mt-4">
          Objections can be registered and decided only while the case is in the notification
          stage. The officer who registers an objection cannot decide it. Objector references are
          personal data and are shown only with landowner read access.
        </Alert>

        {!preliminaryNotice && canRegister ? (
          <Alert variant="warning" className="mt-3">
            There is no preliminary notification with an objection deadline yet, so the backend
            cannot accept an objection. Record the preliminary notification first.
          </Alert>
        ) : null}

        {preliminaryNotice ? (
          <p className="mt-3 text-xs text-slate-500">
            Objection period {formatDate(preliminaryNotice.issuedOn)} to{' '}
            {formatDate(preliminaryNotice.objectionDeadline)}.
          </p>
        ) : null}

        {noticesQuery.error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-warning-700">
            The notice period could not be loaded. ({noticesQuery.error.message})
          </p>
        ) : null}
      </Card>

      {objectionsQuery.error ? (
        <Card>
          <ErrorState
            title="Could not load objections"
            message={objectionsQuery.error.message}
            onRetry={objectionsQuery.reload}
          />
        </Card>
      ) : objectionsQuery.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </Card>
      ) : objections.length === 0 ? (
        <Card>
          <EmptyState
            title="No objections registered"
            description={
              canRegister
                ? 'Register an objection received during the published period.'
                : 'Objections appear here once they are registered.'
            }
            action={
              canRegister ? (
                <Button variant="outline" onClick={() => setRegisterOpen(true)}>
                  Register objection
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {objections.map((objection) => {
            const caseParcel = parcelById.get(objection.caseParcelId)
            return (
              <Card key={objection.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-navy-900">
                        {objection.objectionNumber}
                      </h3>
                      <Badge variant={OBJECTION_STATUS_VARIANTS[objection.status]}>
                        {OBJECTION_STATUS_LABELS[objection.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Received {formatDate(objection.receivedOn)} · affected parcel{' '}
                      <span className="font-mono" title={objection.caseParcelId}>
                        {shortId(objection.caseParcelId)}
                      </span>
                      {caseParcel ? (
                        <>
                          {' · '}
                          {refs.villageName(caseParcel.villageId) ??
                            `Village ${shortId(caseParcel.villageId)}`}
                        </>
                      ) : null}
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {objection.grounds}
                    </p>

                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Objector reference:</span>
                      {objection.objectorReference ? (
                        <span>{objection.objectorReference}</span>
                      ) : (
                        <span title="Masked by the backend">
                          <Badge variant="neutral">Hidden</Badge>
                        </span>
                      )}
                    </p>

                    {objection.decidedAt ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Decided {formatDateTime(objection.decidedAt)}
                        {objection.decisionRemarks
                          ? ` · ${objection.decisionRemarks}`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canDecide(objection) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDecision(objection)}
                      >
                        Decide
                      </Button>
                    ) : objection.status === 'OPEN' &&
                      canDecideStage &&
                      objection.registeredByUserId === user?.id ? (
                      <span className="self-center text-xs text-slate-500">
                        You registered this objection; another officer must decide it.
                      </span>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {registerOpen ? (
        <RegisterObjectionDialog
          acquisitionCase={acquisitionCase}
          parcels={parcels}
          preliminaryNotice={preliminaryNotice}
          parcelsLoading={parcelsQuery.isLoading}
          onClose={() => setRegisterOpen(false)}
          onSaved={() => {
            setRegisterOpen(false)
            objectionsQuery.reload()
          }}
        />
      ) : null}

      {decision ? (
        <DecideObjectionDialog
          acquisitionCase={acquisitionCase}
          objection={decision}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null)
            objectionsQuery.reload()
          }}
        />
      ) : null}
    </div>
  )
}

function latestPreliminaryNotice(notices: NoticeResponse[]): NoticeResponse | null {
  return (
    notices
      .filter((notice) => notice.noticeType === 'PRELIMINARY_NOTIFICATION')
      .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))[0] ?? null
  )
}

function RegisterObjectionDialog({
  acquisitionCase,
  parcels,
  preliminaryNotice,
  parcelsLoading,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  parcels: CaseParcel[]
  preliminaryNotice: NoticeResponse | null
  parcelsLoading: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canReadLandowners = can(PERMISSION.LANDOWNER_READ)
  const mutation = useApiMutation<ObjectionResponse>()
  const [caseParcelId, setCaseParcelId] = useState(parcels[0]?.id ?? '')
  const [receivedOn, setReceivedOn] = useState(todayIso())
  const [grounds, setGrounds] = useState('')
  const [objectorReference, setObjectorReference] = useState('')
  const [errors, setErrors] = useState<{
    caseParcelId?: string
    receivedOn?: string
    grounds?: string
    objectorReference?: string
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
    if (!receivedOn) {
      nextErrors.receivedOn = 'Choose the date the objection was received.'
    } else if (isFutureDate(receivedOn)) {
      nextErrors.receivedOn = 'The received date cannot be in the future.'
    } else if (
      preliminaryNotice &&
      (receivedOn < preliminaryNotice.issuedOn ||
        (preliminaryNotice.objectionDeadline !== null &&
          receivedOn > preliminaryNotice.objectionDeadline))
    ) {
      nextErrors.receivedOn = `The objection must be received between ${formatDate(
        preliminaryNotice.issuedOn,
      )} and ${formatDate(preliminaryNotice.objectionDeadline)}.`
    }

    if (!grounds.trim()) {
      nextErrors.grounds = 'Enter the grounds of the objection.'
    } else if (grounds.trim().length > 2_000) {
      nextErrors.grounds = 'Use at most 2000 characters.'
    }
    if (objectorReference.trim().length > 200) {
      nextErrors.objectorReference = 'Use at most 200 characters.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        registerObjection(acquisitionCase.id, {
          caseParcelId,
          receivedOn,
          grounds: grounds.trim(),
          objectorReference: canReadLandowners
            ? objectorReference.trim() || null
            : null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Objection registered.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="Register an objection"
      description="Record an objection received within the published objection period."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="register-objection-form"
            isLoading={mutation.isLoading}
            disabled={!preliminaryNotice || parcels.length === 0}
          >
            Register objection
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The objection was not registered" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      {!preliminaryNotice ? (
        <Alert variant="warning" className="mb-4">
          A preliminary notification with an objection deadline is required first.
        </Alert>
      ) : (
        <Alert variant="info" className="mb-4">
          Received date must fall between {formatDate(preliminaryNotice.issuedOn)} and{' '}
          {formatDate(preliminaryNotice.objectionDeadline)}.
        </Alert>
      )}

      <form id="register-objection-form" onSubmit={handleSubmit} noValidate className="space-y-4">
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
                ? 'This case has no affected parcels.'
                : 'Only parcels that are still part of this case are listed.'
          }
        >
          <option value="">Select a parcel</option>
          {parcels.map((caseParcel) => (
            <option key={caseParcel.id} value={caseParcel.id}>
              {shortId(caseParcel.parcelId)} · {shortId(caseParcel.villageId)}
            </option>
          ))}
        </Select>

        <Input
          label="Received on"
          type="date"
          required
          max={todayIso()}
          min={preliminaryNotice?.issuedOn}
          value={receivedOn}
          onChange={(event) => {
            setReceivedOn(event.target.value)
            setErrors((current) => ({ ...current, receivedOn: undefined }))
          }}
          error={errors.receivedOn}
          hint="Within the published objection period."
        />

        <Textarea
          label="Grounds"
          required
          value={grounds}
          rows={4}
          maxLength={2_000}
          onChange={(event) => {
            setGrounds(event.target.value)
            setErrors((current) => ({ ...current, grounds: undefined }))
          }}
          error={errors.grounds}
          hint={`${grounds.length}/2000 characters`}
        />

        {canReadLandowners ? (
          <Input
            label="Objector reference (optional)"
            value={objectorReference}
            maxLength={200}
            onChange={(event) => {
              setObjectorReference(event.target.value)
              setErrors((current) => ({ ...current, objectorReference: undefined }))
            }}
            error={errors.objectorReference}
            hint="A reference such as a name or application number. It is stored as personal data."
          />
        ) : (
          <Alert variant="info">
            Your role cannot record objector references. The objection is stored without one.
          </Alert>
        )}
      </form>
    </Modal>
  )
}

function DecideObjectionDialog({
  acquisitionCase,
  objection,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  objection: ObjectionResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<ObjectionResponse>()
  const [outcome, setOutcome] = useState<Exclude<ObjectionStatus, 'OPEN'>>('ACCEPTED')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | undefined>()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const trimmed = remarks.trim()
    if (!trimmed) {
      setError('Remarks are required for an objection decision.')
      return
    }
    if (trimmed.length > 1_000) {
      setError('Use at most 1000 characters.')
      return
    }

    try {
      await mutation.mutate(() =>
        decideObjection(acquisitionCase.id, objection.id, {
          outcome,
          remarks: trimmed,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Objection decision saved.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title={`Decide ${objection.objectionNumber}`}
      description="The decision and remarks are kept in the case record."
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="decide-objection-form"
            isLoading={mutation.isLoading}
          >
            Save decision
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The decision was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="decide-objection-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Select
          label="Outcome"
          required
          value={outcome}
          onChange={(event) =>
            setOutcome(event.target.value as Exclude<ObjectionStatus, 'OPEN'>)
          }
        >
          <option value="ACCEPTED">Accepted</option>
          <option value="DISMISSED">Dismissed</option>
        </Select>

        <Textarea
          label="Remarks (required)"
          value={remarks}
          rows={4}
          maxLength={1_000}
          onChange={(event) => {
            setRemarks(event.target.value)
            setError(undefined)
          }}
          error={error}
          hint={`${remarks.length}/1000 characters`}
        />
      </form>
    </Modal>
  )
}
