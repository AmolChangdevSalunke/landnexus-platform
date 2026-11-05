import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ActionBar } from './ActionBar'
import { API_BASE_URL } from '../../api/client'
import type { ProposalResponse } from '../../api/types'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'

function makeProposal(overrides: Partial<ProposalResponse> = {}): ProposalResponse {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    proposalNumber: 'PRP-2026-000001',
    title: 'District hospital upgrade',
    projectType: 'HOSPITAL',
    status: 'UNDER_SCRUTINY',
    versionNo: 1,
    stateId: '11111111-1111-1111-1111-111111111111',
    districtId: '22222222-2222-2222-2222-222222222222',
    talukaId: null,
    departmentId: '33333333-3333-3333-3333-333333333333',
    lengthKm: null,
    estimatedLandAreaHa: 2.5,
    villageIds: ['44444444-4444-4444-4444-444444444444'],
    alignmentDescription: null,
    description: 'Upgrade the district hospital.',
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    ownerUserId: '55555555-5555-5555-5555-555555555555',
    submittedAt: '2026-01-02T10:00:00Z',
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-02T10:00:00Z',
    projectCode: null,
    availableActions: ['RECOMMEND', 'REJECT_SCRUTINY'],
    ...overrides,
  }
}

describe('ActionBar', () => {
  it('renders only the actions the backend returned', () => {
    renderWithProviders(
      <ActionBar
        proposal={makeProposal({ availableActions: ['RECOMMEND', 'REJECT_SCRUTINY'] })}
        onUpdated={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Recommend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start scrutiny' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('explains when the backend returns no actions', () => {
    renderWithProviders(
      <ActionBar
        proposal={makeProposal({ status: 'SUBMITTED', availableActions: [] })}
        onUpdated={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText('Waiting for scrutiny by an officer.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('sends the action and the optional remarks, then reports the updated proposal', async () => {
    const user = userEvent.setup()
    const proposal = makeProposal({ availableActions: ['RECOMMEND'] })
    const updated = makeProposal({
      status: 'RECOMMENDED',
      availableActions: [],
    })
    const onUpdated = vi.fn()
    let receivedBody: unknown = null

    server.use(
      http.post(
        `${API_BASE_URL}/projects/proposals/${proposal.id}/recommend`,
        async ({ request }) => {
          receivedBody = await request.json()
          return HttpResponse.json(updated)
        },
      ),
    )

    renderWithProviders(
      <ActionBar proposal={proposal} onUpdated={onUpdated} onReload={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Recommend' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Remarks (optional)'), 'Looks complete')
    await user.click(within(dialog).getByRole('button', { name: 'Recommend' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated))
    expect(receivedBody).toEqual({ reason: 'Looks complete' })
  })

  it('asks the header unread badge to refresh after a successful action', async () => {
    const user = userEvent.setup()
    const proposal = makeProposal({ availableActions: ['RECOMMEND'] })
    const updated = makeProposal({ status: 'RECOMMENDED', availableActions: [] })

    server.use(
      http.post(`${API_BASE_URL}/projects/proposals/${proposal.id}/recommend`, () =>
        HttpResponse.json(updated),
      ),
    )

    const { store } = renderWithProviders(
      <ActionBar proposal={proposal} onUpdated={vi.fn()} onReload={vi.fn()} />,
    )

    expect(store.getState().notifications.refreshRevision).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Recommend' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Recommend' }),
    )

    await waitFor(() =>
      expect(store.getState().notifications.refreshRevision).toBe(1),
    )
  })

  it('requires a reason for clarification and sends it to the backend', async () => {
    const user = userEvent.setup()
    const proposal = makeProposal({
      availableActions: ['REQUEST_CLARIFICATION'],
    })
    const updated = makeProposal({
      status: 'CLARIFICATION_REQUESTED',
      availableActions: [],
    })
    const onUpdated = vi.fn()
    let receivedBody: unknown = null

    server.use(
      http.post(
        `${API_BASE_URL}/projects/proposals/${proposal.id}/clarification`,
        async ({ request }) => {
          receivedBody = await request.json()
          return HttpResponse.json(updated)
        },
      ),
    )

    renderWithProviders(
      <ActionBar proposal={proposal} onUpdated={onUpdated} onReload={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Request clarification' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Request clarification' })
    expect(confirm).toBeDisabled()

    await user.type(
      within(dialog).getByLabelText('Reason (required)'),
      'Please attach the land schedule.',
    )
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(receivedBody).not.toBeNull())
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated))
    expect(receivedBody).toEqual({ reason: 'Please attach the land schedule.' })
  })

  it('reloads instead of guessing when the backend returns 409', async () => {
    const user = userEvent.setup()
    const proposal = makeProposal({ availableActions: ['START_SCRUTINY'] })
    const onUpdated = vi.fn()
    const onReload = vi.fn()

    server.use(
      http.post(`${API_BASE_URL}/projects/proposals/${proposal.id}/start-scrutiny`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 409,
            error: 'Conflict',
            message: 'This proposal changed.',
            path: '/api/v1/projects/proposals',
            fieldErrors: [],
          },
          { status: 409 },
        ),
      ),
    )

    renderWithProviders(
      <ActionBar proposal={proposal} onUpdated={onUpdated} onReload={onReload} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start scrutiny' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Start scrutiny' }),
    )

    await waitFor(() => expect(onReload).toHaveBeenCalled())
    expect(onUpdated).not.toHaveBeenCalled()
  })
})
