import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ActionBar } from './ActionBar'
import { API_BASE_URL } from '../../api/client'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, CASE } from './testFixtures'

function renderBar(
  overrides: Partial<typeof CASE>,
  handlers: { onUpdated?: () => void; onReload?: () => void; onOpenAward?: () => void } = {},
) {
  const acquisitionCase = { ...CASE, ...overrides }
  return renderWithProviders(
    <ActionBar
      acquisitionCase={acquisitionCase}
      onUpdated={handlers.onUpdated ?? vi.fn()}
      onReload={handlers.onReload ?? vi.fn()}
      onOpenAward={handlers.onOpenAward ?? vi.fn()}
    />,
    { auth: authWith(['ACQUISITION_DECIDE']) },
  )
}

describe('acquisition ActionBar', () => {
  it('renders only the actions the backend returned', () => {
    renderBar({ status: 'READY_FOR_AWARD', availableActions: ['DECLARE_AWARD', 'CANCEL'] })

    expect(screen.getByRole('button', { name: 'Declare award' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel case' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start survey' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close case' })).not.toBeInTheDocument()
  })

  it('opens the award form instead of running the declaration itself', async () => {
    const user = userEvent.setup()
    const onOpenAward = vi.fn()

    renderBar(
      { status: 'READY_FOR_AWARD', availableActions: ['DECLARE_AWARD'] },
      { onOpenAward },
    )

    await user.click(screen.getByRole('button', { name: 'Declare award' }))
    expect(onOpenAward).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('requires a reason before cancelling and sends it to the backend', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    let receivedBody: unknown = null

    server.use(
      http.post(
        `${API_BASE_URL}/acquisition/cases/${CASE.id}/cancel`,
        async ({ request }) => {
          receivedBody = await request.json()
          return HttpResponse.json({ ...CASE, status: 'CANCELLED', availableActions: [] })
        },
      ),
    )

    renderBar(
      { status: 'READY_FOR_AWARD', availableActions: ['CANCEL'] },
      { onUpdated },
    )

    await user.click(screen.getByRole('button', { name: 'Cancel case' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Cancel case' })
    expect(confirm).toBeDisabled()

    await user.type(
      within(dialog).getByLabelText('Reason (required)'),
      'The alignment was dropped.',
    )
    await user.click(confirm)

    await waitFor(() => expect(receivedBody).toEqual({ reason: 'The alignment was dropped.' }))
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1))
  })

  it('explains the stage when the backend allows no action', () => {
    renderBar({ status: 'CLOSED', availableActions: [] })

    expect(
      screen.getByText(
        'This case is closed. No further workflow actions are available.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
