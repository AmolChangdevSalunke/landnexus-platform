import { useEffect, useState, type FormEvent } from 'react'
import { Award as AwardIcon, PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { declareAward, getAward, getNotices } from '../../api/acquisition'
import { toApiErrorInfo } from '../../api/errors'
import type {
  AwardLine,
  AwardResponse,
  CaseResponse,
  NoticeResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatArea, formatDate, shortId } from '../../utils/format'
import { isFutureDate, todayIso } from './dates'

const AWARD_NUMBER_LIMIT = 40
const REMARKS_LIMIT = 1_000

/**
 * The award endpoint returns 404 until an award exists. That is a normal empty
 * state, not an error, so the query turns it into null.
 */
function loadAward(caseId: string): Promise<AwardResponse | null> {
  return getAward(caseId).catch((caught: unknown) => {
    if (toApiErrorInfo(caught).status === 404) {
      return null
    }
    throw caught
  })
}

export function AwardTab({
  acquisitionCase,
  reloadKey,
  formOpen,
  onFormClose,
  onChanged,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
  formOpen: boolean
  onFormClose: () => void
  onChanged: () => void
}) {
  const [showForm, setShowForm] = useState(formOpen)

  const awardQuery = useApiQuery<AwardResponse | null>(
    () => loadAward(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )
  const noticesQuery = useApiQuery(
    () => getNotices(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  useEffect(() => {
    if (formOpen) {
      setShowForm(true)
    }
  }, [formOpen])

  const award = awardQuery.data
  const canDeclare = acquisitionCase.availableActions.includes('DECLARE_AWARD')
  const preliminaryNotice = latestPreliminaryNotice(noticesQuery.data ?? [])
  const objectionDeadline = preliminaryNotice?.objectionDeadline ?? null

  function closeForm() {
    setShowForm(false)
    onFormClose()
  }

  const columns: TableColumn<AwardLine>[] = [
    {
      key: 'parcel',
      header: 'Parcel',
      render: (line) => (
        <div className="min-w-40">
          <p className="font-mono text-xs font-semibold text-navy-900" title={line.parcelId}>
            {shortId(line.parcelId)}
          </p>
          <p
            className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-slate-500"
            title={line.caseParcelId}
          >
            Case parcel {shortId(line.caseParcelId)}
            <CopyButton value={line.caseParcelId} label="case parcel id" />
          </p>
        </div>
      ),
    },
    {
      key: 'area',
      header: 'Awarded area',
      render: (line) => (
        <span className="whitespace-nowrap font-medium text-slate-800">
          {formatArea(line.awardedAreaHa)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Award"
          description="The award records the award number, date and one line per affected parcel. The backend creates the lines."
          action={
            canDeclare && !award ? (
              <Button
                onClick={() => setShowForm(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Declare award
              </Button>
            ) : null
          }
        />
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          Compensation is recorded in the Valuation, Payments and R&amp;R tabs when your role can
          read them.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          This tab records the award only. It never stores or estimates a money value.
        </p>
      </Card>

      {awardQuery.error ? (
        <Card>
          <ErrorState
            title="Could not load the award"
            message={awardQuery.error.message}
            onRetry={awardQuery.reload}
          />
        </Card>
      ) : awardQuery.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : !award ? (
        <Card>
          <EmptyState
            icon={<AwardIcon aria-hidden="true" className="h-6 w-6" />}
            title="No award declared yet"
            description={
              canDeclare
                ? 'Declare the award once the objection window is closed and the case is ready.'
                : 'The award appears here after a competent authority declares it.'
            }
            action={
              canDeclare ? (
                <Button variant="outline" onClick={() => setShowForm(true)}>
                  Declare award
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-navy-900">
                  Award {award.awardNumber}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Declared on {formatDate(award.awardDate)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  <span>Declared by user</span>
                  <span className="font-mono" title={award.declaredByUserId}>
                    {shortId(award.declaredByUserId)}
                  </span>
                  <CopyButton value={award.declaredByUserId} label="declaring user id" />
                </p>
                {award.remarks ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">Remarks:</span> {award.remarks}
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {award.lines.length} {award.lines.length === 1 ? 'parcel' : 'parcels'}
              </p>
            </div>
          </Card>

          <div className="flex justify-end">
            <LinkButton
              to={`/acquisition/${acquisitionCase.id}/award/print`}
              variant="outline"
              size="sm"
            >
              Print award letter
            </LinkButton>
          </div>

          <DataTable
            columns={columns}
            rows={award.lines}
            rowKey={(line) => line.caseParcelId}
            caption={`Awarded area per parcel for ${acquisitionCase.caseNumber}`}
            emptyTitle="No award lines"
            emptyDescription="The backend creates one line for every affected parcel."
          />
        </>
      )}

      {noticesQuery.error ? (
        <p role="alert" className="text-xs font-medium text-warning-700">
          The objection period could not be loaded. The backend still validates the award date.
        </p>
      ) : null}

      {showForm ? (
        <DeclareAwardDialog
          acquisitionCase={acquisitionCase}
          objectionDeadline={objectionDeadline}
          noticesLoading={noticesQuery.isLoading}
          onClose={closeForm}
          onSaved={() => {
            closeForm()
            awardQuery.reload()
            noticesQuery.reload()
            onChanged()
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

function DeclareAwardDialog({
  acquisitionCase,
  objectionDeadline,
  noticesLoading,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  objectionDeadline: string | null
  noticesLoading: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<AwardResponse>()
  const [awardNumber, setAwardNumber] = useState('')
  const [awardDate, setAwardDate] = useState(todayIso())
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<{
    awardNumber?: string
    awardDate?: string
    remarks?: string
  }>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: typeof errors = {}
    const number = awardNumber.trim()
    if (!number) {
      nextErrors.awardNumber = 'Enter the award number.'
    } else if (number.length > AWARD_NUMBER_LIMIT) {
      nextErrors.awardNumber = `Use at most ${AWARD_NUMBER_LIMIT} characters.`
    }

    if (!awardDate) {
      nextErrors.awardDate = 'Choose the award date.'
    } else if (isFutureDate(awardDate)) {
      nextErrors.awardDate = 'The award date cannot be in the future.'
    } else if (objectionDeadline && awardDate < objectionDeadline) {
      nextErrors.awardDate = `The award date cannot be before the end of the objection period (${formatDate(
        objectionDeadline,
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
        declareAward(acquisitionCase.id, {
          awardNumber: number,
          awardDate,
          remarks: remarks.trim() || null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'The award has been declared.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="Declare the award"
      description="This moves the case to Award declared and records one line per affected parcel."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="declare-award-form"
            isLoading={mutation.isLoading}
            disabled={mutation.isLoading}
          >
            Declare award
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The award was not declared" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      {noticesLoading ? (
        <p className="mb-3 text-xs text-slate-500">Loading the objection period…</p>
      ) : objectionDeadline ? (
        <Alert variant="info" className="mb-4">
          The award date cannot be before the end of the objection period (
          {formatDate(objectionDeadline)}).
        </Alert>
      ) : (
        <Alert variant="warning" className="mb-4">
          The objection period could not be confirmed. The backend still rejects an award date
          before the end of that period.
        </Alert>
      )}

      <form id="declare-award-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Award number"
          required
          maxLength={AWARD_NUMBER_LIMIT}
          value={awardNumber}
          onChange={(event) => {
            setAwardNumber(event.target.value)
            setErrors((current) => ({ ...current, awardNumber: undefined }))
          }}
          error={errors.awardNumber}
          hint={`${awardNumber.length}/${AWARD_NUMBER_LIMIT} characters.`}
        />

        <Input
          label="Award date"
          type="date"
          required
          max={todayIso()}
          min={objectionDeadline ?? undefined}
          value={awardDate}
          onChange={(event) => {
            setAwardDate(event.target.value)
            setErrors((current) => ({ ...current, awardDate: undefined }))
          }}
          error={errors.awardDate}
          hint="It cannot be in the future or before the objection deadline."
        />

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

        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Compensation is recorded in the Valuation, Payments and R&amp;R tabs when your role can
          read them.
        </p>
      </form>
    </Modal>
  )
}
