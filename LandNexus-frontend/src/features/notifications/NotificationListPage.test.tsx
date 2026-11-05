import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { NotificationListPage } from './NotificationListPage'
import { API_BASE_URL } from '../../api/client'
import type { NotificationItem } from '../../api/types'
import { TEST_USER } from '../../test/handlers'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'

const AUTH = {
  user: TEST_USER,
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

const UNREAD: NotificationItem = {
  id: '99999999-9999-9999-9999-999999999999',
  type: 'PROPOSAL',
  title: 'Proposal recommended',
  message: 'The proposal is waiting for a final decision.',
  entityType: 'Proposal',
  entityId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  read: false,
  createdAt: '2026-02-02T10:00:00Z',
}

const READ: NotificationItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  type: 'PROJECT_APPROVED',
  title: 'Project created',
  message: 'The project was created after approval.',
  entityType: 'Project',
  entityId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  read: true,
  createdAt: '2026-02-01T10:00:00Z',
}

function page<T>(content: T[], size = 20) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

describe('NotificationListPage', () => {
  it('shows real notifications with links to their entity', async () => {
    server.use(
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json(page([UNREAD, READ])),
      ),
    )

    renderWithProviders(<NotificationListPage />, { auth: AUTH })

    expect(await screen.findByText(UNREAD.title)).toBeInTheDocument()
    expect(screen.getByText(READ.title)).toBeInTheDocument()
    expect(screen.getByText(UNREAD.message)).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Your notifications' })
    expect(within(table).getByText('Unread')).toBeInTheDocument()
    const openLinks = screen.getAllByRole('link', { name: 'Open' })
    expect(openLinks[0]).toHaveAttribute('href', `/proposals/${UNREAD.entityId}`)
    expect(openLinks[1]).toHaveAttribute('href', `/projects/${READ.entityId}`)
  })

  it('asks the backend for unread items only when the filter changes', async () => {
    const user = userEvent.setup()
    let lastUrl: string | null = null

    server.use(
      http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
        lastUrl = request.url
        return HttpResponse.json(page([UNREAD]))
      }),
    )

    renderWithProviders(<NotificationListPage />, { auth: AUTH })

    await screen.findByText(UNREAD.title)
    await user.selectOptions(screen.getByLabelText('Show'), 'unread')

    await waitFor(() => {
      expect(lastUrl).not.toBeNull()
      expect(new URL(String(lastUrl)).searchParams.get('unreadOnly')).toBe('true')
    })
  })

  it('marks a notification as read and reloads the list', async () => {
    const user = userEvent.setup()
    let markedRead = false
    let postCount = 0

    server.use(
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json(page([{ ...UNREAD, read: markedRead }])),
      ),
      http.post(`${API_BASE_URL}/notifications/${UNREAD.id}/read`, () => {
        markedRead = true
        postCount += 1
        return HttpResponse.json({ ...UNREAD, read: true })
      }),
    )

    renderWithProviders(<NotificationListPage />, { auth: AUTH })

    await screen.findByText(UNREAD.title)
    await user.click(screen.getByRole('button', { name: 'Mark as read' }))

    await waitFor(() => expect(postCount).toBe(1))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument(),
    )
    expect(screen.getByText(UNREAD.title)).toBeInTheDocument()
    expect(screen.queryByText('Unread')).not.toBeInTheDocument()
  })

  it('shows an honest empty state for unread notifications', async () => {
    server.use(
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json(page<NotificationItem>([])),
      ),
    )

    renderWithProviders(<NotificationListPage />, { auth: AUTH })

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument()
    expect(
      screen.getByText('Workflow and account notifications for you will appear here.'),
    ).toBeInTheDocument()
  })

  it('shows the backend message when notifications cannot be loaded', async () => {
    server.use(
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 401,
            error: 'Unauthorized',
            message: 'Your session has expired.',
            path: '/api/v1/notifications',
            fieldErrors: [],
          },
          { status: 401 },
        ),
      ),
    )

    renderWithProviders(<NotificationListPage />, { auth: AUTH })

    expect(await screen.findByText('Your session has expired')).toBeInTheDocument()
    expect(
      screen.getByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument()
  })
})
