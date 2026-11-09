import { useState } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { requestUnreadRefresh } from '../notifications/notificationsSlice'
import { toApiErrorInfo } from '../../api/errors'
import {
  cancelCase,
  closeCase,
  closeObjectionWindow,
  completePossession,
  completeVerification,
  issueNotification,
  startSurvey,
} from '../../api/acquisition'
import type { CaseAction, CaseResponse } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import {
  CASE_ACTION_META,
  isCaseAction,
  noActionMessage,
} from './labels'

type RunnableAction = Exclude<CaseAction, 'DECLARE_AWARD'>

const RUNNERS: Record<RunnableAction, (caseId: string, reason?: string) => Promise<CaseResponse>> = {
  START_SURVEY: (caseId) => startSurvey(caseId),
  COMPLETE_VERIFICATION: (caseId) => completeVerification(caseId),
  ISSUE_NOTIFICATION: (caseId) => issueNotification(caseId),
  CLOSE_OBJECTION_WINDOW: (caseId) => closeObjectionWindow(caseId),
  COMPLETE_POSSESSION: (caseId) => completePossession(caseId),
  CLOSE: (caseId, reason) => closeCase(caseId, reason),
  CANCEL: (caseId, reason) => cancelCase(caseId, reason ?? ''),
}

export interface ActionBarProps {
  acquisitionCase: CaseResponse
  onUpdated: () => void
  onReload: () => void
  onOpenAward: () => void
}

/**
 * Renders exactly the actions the backend returned in `availableActions`.
 * The workflow itself is never re-implemented on the client.
 */
export function ActionBar({
  acquisitionCase,
  onUpdated,
  onReload,
  onOpenAward,
}: ActionBarProps) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<CaseResponse>()
  const [pendingAction, setPendingAction] = useState<RunnableAction | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  const actions = acquisitionCase.availableActions.filter(isCaseAction)
  const meta = pendingAction ? CASE_ACTION_META[pendingAction] : null
  const requiresReason = meta?.reason === 'required'
  const confirmDisabled =
    mutation.isLoading || (requiresReason === true && reason.trim().length === 0)

  function openAction(action: RunnableAction) {
    mutation.reset()
    setPendingAction(action)
    setReason('')
    setReasonError(null)
  }

  function closeAction() {
    if (mutation.isLoading) {
      return
    }
    setPendingAction(null)
    setReason('')
    setReasonError(null)
  }

  async function runAction(action: RunnableAction) {
    const actionMeta = CASE_ACTION_META[action]
    const trimmed = reason.trim()

    if (actionMeta.reason === 'required' && !trimmed) {
      setReasonError('A reason is required.')
      return
    }
    if (trimmed.length > 1_000) {
      setReasonError('The reason must be at most 1000 characters.')
      return
    }

    try {
      await mutation.mutate(() => RUNNERS[action](acquisitionCase.id, trimmed || undefined))
      dispatch(
        addToast({
          variant: 'success',
          message: actionMeta.successMessage,
        }),
      )
      dispatch(requestUnreadRefresh())
      setPendingAction(null)
      setReason('')
      setReasonError(null)
      onUpdated()
    } catch (caught: unknown) {
      const info = toApiErrorInfo(caught)
      if (info.status === 409) {
        dispatch(
          addToast({
            variant: 'error',
            title: 'Case changed',
            message:
              'This case was changed or this action is no longer allowed. Reloading…',
          }),
        )
        setPendingAction(null)
        onReload()
        return
      }
      dispatch(
        addToast({
          variant: 'error',
          title: 'Action not completed',
          message: info.message,
        }),
      )
    }
  }

  return (
    <Card className="p-4">
      <CardHeader
        title="Workflow actions"
        description="Only actions the backend says you may take now are listed."
      />

      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          {noActionMessage(acquisitionCase.status)}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => {
            const actionMeta = CASE_ACTION_META[action]
            return (
              <Button
                key={action}
                variant={actionMeta.variant}
                disabled={mutation.isLoading}
                onClick={() => {
                  if (action === 'DECLARE_AWARD') {
                    onOpenAward()
                    return
                  }
                  openAction(action)
                }}
              >
                {actionMeta.label}
              </Button>
            )
          })}
        </div>
      )}

      {pendingAction && meta && meta.reason === 'none' ? (
        <ConfirmDialog
          title={meta.dialogTitle}
          message={meta.dialogDescription}
          confirmLabel={meta.confirmLabel}
          variant={meta.variant === 'danger' ? 'danger' : 'primary'}
          isLoading={mutation.isLoading}
          onConfirm={() => void runAction(pendingAction)}
          onClose={closeAction}
        />
      ) : null}

      {pendingAction && meta && meta.reason !== 'none' ? (
        <Modal
          title={meta.dialogTitle}
          description={meta.dialogDescription}
          onClose={closeAction}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={closeAction} disabled={mutation.isLoading}>
                Back
              </Button>
              <Button
                variant={meta.variant}
                onClick={() => void runAction(pendingAction)}
                disabled={confirmDisabled}
                isLoading={mutation.isLoading}
              >
                {meta.confirmLabel}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {mutation.error && mutation.error.status !== 409 ? (
              <Alert variant="error">{mutation.error.message}</Alert>
            ) : null}

            <Textarea
              label={requiresReason ? 'Reason (required)' : 'Remarks (optional)'}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                if (reasonError) {
                  setReasonError(null)
                }
              }}
              maxLength={1_000}
              rows={4}
              hint={`${reason.length}/1000 characters`}
              error={reasonError ?? undefined}
            />
          </div>
        </Modal>
      ) : null}
    </Card>
  )
}
