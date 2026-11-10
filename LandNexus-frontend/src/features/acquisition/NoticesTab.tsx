import { useState, type FormEvent } from 'react'
import { PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { getNotices, recordNotice } from '../../api/acquisition'
import type {
  CaseResponse,
  NoticeResponse,
  NoticeType,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDate } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { isFutureDate, todayIso } from './dates'
import {
  NOTICE_TYPE_LABELS,
  NOTICE_TYPE_VARIANTS,
  recordableNoticeTypes,
} from './labels'

export function NoticesTab({
  acquisitionCase,
  reloadKey,
}: {
  acquisitionCase: CaseResponse
  reloadKey: number
}) {
  const { can } = useAuth()
  const [recordOpen, setRecordOpen] = useState(false)
  const canManage = can(PERMISSION.ACQUISITION_MANAGE)
  const query = useApiQuery(
    () => getNotices(acquisitionCase.id),
    [acquisitionCase.id, reloadKey],
  )

  const allowedTypes = recordableNoticeTypes(acquisitionCase.status)
  const canRecord = canManage && allowedTypes.length > 0
  const notices = (query.data ?? [])
    .slice()
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Legal notices"
          description="Notices are recorded with their reference, issue date and (for the preliminary notification) the objection deadline."
          action={
            canRecord ? (
              <Button
                onClick={() => setRecordOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Record notice
              </Button>
            ) : null
          }
        />
        <Alert variant="info" className="mt-4">
          The backend decides which notice type is valid in each stage. A preliminary
          notification is recorded after survey verification; the final declaration becomes
          available when the case is ready for the award.
        </Alert>
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title="Could not load notices"
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
      ) : notices.length === 0 ? (
        <Card>
          <EmptyState
            title="No notices recorded"
            description={
              canRecord
                ? 'Record the first legal notice for this case.'
                : 'Notices appear here after an authorised officer records them.'
            }
            action={
              canRecord ? (
                <Button variant="outline" onClick={() => setRecordOpen(true)}>
                  Record notice
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card key={notice.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-navy-900">
                      {NOTICE_TYPE_LABELS[notice.noticeType]}
                    </h3>
                    <Badge variant={NOTICE_TYPE_VARIANTS[notice.noticeType]}>
                      Recorded
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    Reference {notice.referenceNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Issued {formatDate(notice.issuedOn)}
                    {notice.objectionDeadline
                      ? ` · objection deadline ${formatDate(notice.objectionDeadline)}`
                      : ''}
                    {notice.createdBy ? ` · recorded by ${notice.createdBy}` : ''}
                  </p>
                  {notice.description ? (
                    <p className="mt-2 text-sm text-slate-700">{notice.description}</p>
                  ) : null}
                </div>
                <LinkButton
                  to={`/acquisition/notices/${acquisitionCase.id}/${notice.id}`}
                  variant="ghost"
                  size="sm"
                >
                  Print letter
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {recordOpen ? (
        <RecordNoticeDialog
          acquisitionCase={acquisitionCase}
          allowedTypes={allowedTypes}
          onClose={() => setRecordOpen(false)}
          onSaved={() => {
            setRecordOpen(false)
            query.reload()
          }}
        />
      ) : null}
    </div>
  )
}

function RecordNoticeDialog({
  acquisitionCase,
  allowedTypes,
  onClose,
  onSaved,
}: {
  acquisitionCase: CaseResponse
  allowedTypes: NoticeType[]
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<NoticeResponse>()
  const [noticeType, setNoticeType] = useState<NoticeType>(allowedTypes[0] ?? 'OTHER')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [issuedOn, setIssuedOn] = useState(todayIso())
  const [objectionDeadline, setObjectionDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<{
    referenceNumber?: string
    issuedOn?: string
    objectionDeadline?: string
    description?: string
  }>({})

  const needsDeadline = noticeType === 'PRELIMINARY_NOTIFICATION'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: typeof errors = {}
    const reference = referenceNumber.trim()
    if (!reference) {
      nextErrors.referenceNumber = 'Enter the notice reference number.'
    } else if (reference.length > 60) {
      nextErrors.referenceNumber = 'Use at most 60 characters.'
    }

    if (!issuedOn) {
      nextErrors.issuedOn = 'Choose the issue date.'
    } else if (isFutureDate(issuedOn)) {
      nextErrors.issuedOn = 'The issue date cannot be in the future.'
    }

    if (needsDeadline && !objectionDeadline) {
      nextErrors.objectionDeadline = 'The objection deadline is required for a preliminary notification.'
    } else if (objectionDeadline && objectionDeadline < issuedOn) {
      nextErrors.objectionDeadline = 'The deadline cannot be before the issue date.'
    }

    if (description.trim().length > 1_000) {
      nextErrors.description = 'Use at most 1000 characters.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        recordNotice(acquisitionCase.id, {
          noticeType,
          referenceNumber: reference,
          issuedOn,
          objectionDeadline: needsDeadline ? objectionDeadline : null,
          description: description.trim() || null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Notice recorded.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="Record a legal notice"
      description="The case stage decides which notice types are accepted."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="record-notice-form" isLoading={mutation.isLoading}>
            Record notice
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The notice was not recorded" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="record-notice-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Select
          label="Notice type"
          required
          value={noticeType}
          onChange={(event) => {
            setNoticeType(event.target.value as NoticeType)
            setErrors({})
          }}
          hint={`Allowed in this stage: ${allowedTypes.map((type) => NOTICE_TYPE_LABELS[type]).join(', ')}.`}
        >
          {allowedTypes.map((type) => (
            <option key={type} value={type}>
              {NOTICE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>

        <Input
          label="Reference number"
          required
          maxLength={60}
          value={referenceNumber}
          onChange={(event) => {
            setReferenceNumber(event.target.value)
            setErrors((current) => ({ ...current, referenceNumber: undefined }))
          }}
          error={errors.referenceNumber}
          hint={`${referenceNumber.length}/60 characters. The reference must be unique for this case.`}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Issue date"
            type="date"
            required
            max={todayIso()}
            value={issuedOn}
            onChange={(event) => {
              setIssuedOn(event.target.value)
              setErrors((current) => ({ ...current, issuedOn: undefined }))
            }}
            error={errors.issuedOn}
            hint="It may be in the past if the notice was already published."
          />

          {needsDeadline ? (
            <Input
              label="Objection deadline"
              type="date"
              required
              min={issuedOn || undefined}
              value={objectionDeadline}
              onChange={(event) => {
                setObjectionDeadline(event.target.value)
                setErrors((current) => ({ ...current, objectionDeadline: undefined }))
              }}
              error={errors.objectionDeadline}
              hint="Objections can be registered only up to this date."
            />
          ) : null}
        </div>

        <Textarea
          label="Description (optional)"
          value={description}
          rows={3}
          maxLength={1_000}
          onChange={(event) => {
            setDescription(event.target.value)
            setErrors((current) => ({ ...current, description: undefined }))
          }}
          error={errors.description}
          hint={`${description.length}/1000 characters`}
        />
      </form>
    </Modal>
  )
}
