import { useState } from 'react'
import { toApiErrorInfo } from '../../api/errors'
import {
  getProposalReassignmentCandidates,
  reassignProposalAssignment,
} from '../../api/proposals'
import type {
  AssignmentStage,
  ProposalAssignment,
  ProposalStatus,
  ReassignmentCandidate,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Textarea'

function activeStage(status: ProposalStatus): AssignmentStage | null {
  if (status === 'SUBMITTED' || status === 'UNDER_SCRUTINY') {
    return 'SCRUTINY'
  }
  return status === 'RECOMMENDED' ? 'DECISION' : null
}

export function ProposalReassignmentPanel({
  proposalId,
  status,
  assignments,
  canManage,
  onChanged,
}: {
  proposalId: string
  status: ProposalStatus
  assignments: ProposalAssignment[]
  canManage: boolean
  onChanged: () => void
}) {
  const stage = activeStage(status)
  const currentAssignment = stage
    ? [...assignments].reverse().find(
        (assignment) =>
          assignment.stage === stage &&
          (assignment.status === 'PENDING' || assignment.status === 'IN_PROGRESS'),
      )
    : undefined
  const [dialogOpen, setDialogOpen] = useState(false)
  const [candidates, setCandidates] = useState<ReassignmentCandidate[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canManage || !currentAssignment) {
    return null
  }
  const assignmentToReassign = currentAssignment

  async function openDialog() {
    setLoading(true)
    setError(null)
    try {
      const available = await getProposalReassignmentCandidates(proposalId, assignmentToReassign.stage)
      setCandidates(available)
      setSelectedUserId('')
      setReason('')
      setDialogOpen(true)
    } catch (caught: unknown) {
      setError(toApiErrorInfo(caught).message)
    } finally {
      setLoading(false)
    }
  }

  async function submitReassignment() {
    const trimmedReason = reason.trim()
    if (!selectedUserId || !trimmedReason || trimmedReason.length > 1_000) {
      setError('Select an eligible officer and provide a reason of at most 1000 characters.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await reassignProposalAssignment(
        proposalId,
        assignmentToReassign.id,
        selectedUserId,
        trimmedReason,
      )
      setDialogOpen(false)
      onChanged()
    } catch (caught: unknown) {
      setError(toApiErrorInfo(caught).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      {error && !dialogOpen ? (
        <Alert variant="warning" title="Assignment not changed" className="mb-2">
          {error}
        </Alert>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => void openDialog()} isLoading={loading}>
        Reassign current task
      </Button>

      {dialogOpen ? (
        <Modal
          title="Reassign proposal task"
          description="Only eligible officers returned by the backend can be selected. The reassignment reason is audited."
          onClose={() => {
            if (!loading) setDialogOpen(false)
          }}
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void submitReassignment()}
                disabled={!selectedUserId || !reason.trim() || reason.trim().length > 1_000}
                isLoading={loading}
              >
                Confirm reassignment
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {error ? <Alert variant="warning" title="Could not reassign">{error}</Alert> : null}
            {candidates.length === 0 ? (
              <Alert variant="warning" title="No eligible officers">
                No enabled officer is currently eligible for this assignment stage and district.
              </Alert>
            ) : (
              <div>
                <label htmlFor="reassignment-officer" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Eligible officer
                </label>
                <select
                  id="reassignment-officer"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                >
                  <option value="">Select an officer</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.username} ({candidate.scopeLevel.toLowerCase()} scope)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Textarea
              label="Reason for reassignment"
              required
              maxLength={1_000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="This reason is recorded in the assignment audit history."
              disabled={candidates.length === 0}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
