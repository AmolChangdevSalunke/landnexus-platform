import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { AuditTrailPage } from './AuditTrailPage'
import { API_BASE_URL } from '../../../api/client'
import type { AuditEventResponse } from '../../../api/types'
import { TEST_USER } from '../../../test/handlers'
import { renderWithProviders } from '../../../test/render'
import { server } from '../../../test/server'

const AUTH = {
  user: { ...TEST_USER, permissions: ['AUDIT_READ'] },
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

const EVENTS: AuditEventResponse[] = [
  {
    id: 'e1',
    occurredAt: '2026-02-02T10:00:00Z',
    actorUserId: TEST_USER.id,
    actorUsername: 'consultant.one',
    action: 'CREATE',
    entityType: 'Proposal',
    entityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    details: 'title=New school, district=Pune',
  },
  {
    id: 'e2',
    occurredAt: '2026-02-01T09:00:00Z',
    actorUserId: null,
    actorUsername: 'system',
    action: 'DISABLE',
    entityType: 'UserAccount',
    entityId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    details: null,
  },
]

function page<T>(content: T[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
  }
}

describe('AuditTrailPage', () => {
  it('lists newest-first events and expands event details', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${API_BASE_URL}/administration/audit-events`, () =>
        HttpResponse.json(page(EVENTS)),
      ),
    )

    renderWithProviders(<AuditTrailPage />, { auth: AUTH })

    await screen.findByRole('heading', { name: 'Audit trail' })
    expect(await screen.findByText('consultant.one')).toBeInTheDocument()
    expect(screen.getByText('CREATE')).toBeInTheDocument()
    expect(screen.getByText('Proposal')).toBeInTheDocument()
    expect(screen.getByText('system')).toBeInTheDocument()

    await user.click(screen.getByText('View details'))
    expect(screen.getByText('title=New school, district=Pune')).toBeInTheDocument()
  })

  it('requires an entity type before filtering by entity id', async () => {
    const user = userEvent.setup()
    const requests: URLSearchParams[] = []

    server.use(
      http.get(`${API_BASE_URL}/administration/audit-events`, ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(page(EVENTS))
      }),
    )

    renderWithProviders(<AuditTrailPage />, { auth: AUTH })
    await screen.findByText('consultant.one')

    await user.type(screen.getByLabelText('Entity id'), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(
      screen.getByText('An entity type is required when filtering by entity id.'),
    ).toBeInTheDocument()
    expect(requests).toHaveLength(1)

    await user.type(screen.getByLabelText('Entity type'), 'Proposal')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1]?.get('entityType')).toBe('Proposal')
    expect(requests[1]?.get('entityId')).toBe(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    )
  })
})
