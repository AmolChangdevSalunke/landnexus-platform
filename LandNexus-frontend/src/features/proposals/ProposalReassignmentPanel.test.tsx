import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getProposalReassignmentCandidates, reassignProposalAssignment } from '../../api/proposals'
import type { ProposalAssignment } from '../../api/types'
import { ProposalReassignmentPanel } from './ProposalReassignmentPanel'

vi.mock('../../api/proposals', () => ({
  getProposalReassignmentCandidates: vi.fn(),
  reassignProposalAssignment: vi.fn(),
}))

const assignment: ProposalAssignment = {
  id: 'assignment-1',
  proposalId: 'proposal-1',
  stage: 'SCRUTINY',
  assignedUserId: 'officer-1',
  assignedUsername: 'current.officer',
  assignedBy: 'SYSTEM',
  ruleNote: null,
  status: 'IN_PROGRESS',
  assignedAt: '2025-01-01T00:00:00Z',
  startedAt: '2025-01-01T00:00:00Z',
  completedAt: null,
  dueAt: '2025-01-10T00:00:00Z',
  overdue: false,
}

describe('ProposalReassignmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('only offers reassignment when permitted and a task is active', () => {
    const { rerender } = render(
      <ProposalReassignmentPanel
        proposalId="proposal-1"
        status="UNDER_SCRUTINY"
        assignments={[assignment]}
        canManage={false}
        onChanged={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /reassign current task/i })).toBeNull()

    rerender(
      <ProposalReassignmentPanel
        proposalId="proposal-1"
        status="APPROVED"
        assignments={[assignment]}
        canManage
        onChanged={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /reassign current task/i })).toBeNull()
  })

  it('loads eligible officers and confirms a reasoned reassignment', async () => {
    const onChanged = vi.fn()
    vi.mocked(getProposalReassignmentCandidates).mockResolvedValue([
      { id: 'officer-2', username: 'eligible.officer', scopeLevel: 'DISTRICT' },
    ])
    vi.mocked(reassignProposalAssignment).mockResolvedValue(assignment)

    render(
      <ProposalReassignmentPanel
        proposalId="proposal-1"
        status="UNDER_SCRUTINY"
        assignments={[assignment]}
        canManage
        onChanged={onChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /reassign current task/i }))
    await screen.findByRole('dialog')
    expect(getProposalReassignmentCandidates).toHaveBeenCalledWith('proposal-1', 'SCRUTINY')

    fireEvent.change(screen.getByLabelText('Eligible officer'), {
      target: { value: 'officer-2' },
    })
    fireEvent.change(screen.getByLabelText(/Reason for reassignment/), {
      target: { value: 'Officer workload balancing' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reassignment' }))

    await waitFor(() => {
      expect(reassignProposalAssignment).toHaveBeenCalledWith(
        'proposal-1',
        'assignment-1',
        'officer-2',
        'Officer workload balancing',
      )
      expect(onChanged).toHaveBeenCalledOnce()
    })
  })
})
