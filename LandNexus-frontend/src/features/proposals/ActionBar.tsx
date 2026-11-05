import { useState } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { requestUnreadRefresh } from '../notifications/notificationsSlice'
import { toApiErrorInfo } from '../../api/errors'
import { performProposalAction } from '../../api/proposals'
import type { ProposalAction, ProposalResponse } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import {
  PROPOSAL_ACTION_META,
  actionSuccessMessage,
  noActionMessage,
} from './labels'

export interface ActionBarProps {
  proposal: ProposalResponse
  onUpdated: (proposal: ProposalResponse) => void
  onReload: () => void
}

/**
 * Renders exactly the actions the backend says the current user may take.
 * No workflow rule is re-implemented here.
 */
export function ActionBar({ proposal, onUpdated, onReload }: ActionBarProps) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<ProposalResponse>()
  const [pendingAction, setPendingAction] = useState<ProposalAction | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  const meta = pendingAction ? PROPOSAL_ACTION_META[pendingAction] : null
  const requiresReason = meta?.reason === 'required'
  const confirmDisabled =
    mutation.isLoading || (requiresReason === true && reason.trim().length === 0)

  function openAction(action: ProposalAction) {
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

  async function runAction(action: ProposalAction) {
    const actionMeta = PROPOSAL_ACTION_META[action]
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
      const updated = await mutation.mutate(() =>
        performProposalAction(proposal.id, action, trimmed),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: actionSuccessMessage(action, updated.projectCode),
        }),
      )
      dispatch(requestUnreadRefresh())
      setPendingAction(null)
      setReason('')
      setReasonError(null)
      onUpdated(updated)
    } catch (caught: unknown) {
      const info = toApiErrorInfo(caught)
      if (info.status === 409) {
        dispatch(
          addToast({
            variant: 'error',
            title: 'Proposal changed',
            message:
              'This proposal was changed or this action is no longer allowed. Reloading…',
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
        title="Actions"
        description="Available to you right now, as decided by the backend."
      />

      {proposal.availableActions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{noActionMessage(proposal.status)}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {proposal.availableActions.map((action) => {
            const actionMeta = PROPOSAL_ACTION_META[action]
            return (
              <Button
                key={action}
                variant={actionMeta.variant}
                onClick={() => openAction(action)}
                disabled={mutation.isLoading}
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
                Cancel
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
            {pendingAction === 'APPROVE' ? (
              <Alert variant="warning">
                A government project will be created from this proposal. Approval is final.
              </Alert>
            ) : null}

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
