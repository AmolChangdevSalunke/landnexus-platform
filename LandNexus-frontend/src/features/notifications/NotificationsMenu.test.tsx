import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { NotificationsMenu } from './NotificationsMenu'
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

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: '99999999-9999-9999-9999-999999999999',
    type: 'PROPOSAL',
    title: 'Proposal recommended',
    message: 'The proposal is waiting for a final decision.',
    entityType: 'Proposal',
    entityId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    read: false,
    createdAt: '2026-02-02T10:00:00Z',
    ...overrides,
  }
}

function latestPage(items: NotificationItem[]) {
  return {
    content: items,
    page: 0,
    size: 5,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  }
}

function renderMenu(unread: number) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<NotificationsMenu unread={unread} />} />
      <Route path="/proposals/:id" element={<p>Proposal details page</p>} />
      <Route path="/projects/:id" element={<p>Project details page</p>} />
    </Routes>,
    { auth: AUTH, initialEntries: ['/'] },
  )
}

describe('NotificationsMenu', () => {
  it('shows the latest five notifications in the header dropdown', async () => {
    const user = userEvent.setup()
    const items = Array.from({ length: 5 }, (_, index) =>
      makeNotification({
        id: `notification-${index}`,
        title: `Notification ${index + 1}`,
        read: index > 0,
      }),
    )
    let requestUrl: string | null = null

    server.use(
      http.get(`${API_BASE_URL}/notifications`, ({ request }) => {
        requestUrl = request.url
        return HttpResponse.json(latestPage(items))
      }),
    )

    renderMenu(2)

    await user.click(screen.getByRole('button', { name: 'Notifications, 2 unread' }))

    expect(await screen.findByText('Notification 1')).toBeInTheDocument()
    const menu = screen.getByRole('menu', { name: 'Recent notifications' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(5)
    expect(within(menu).getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/notifications',
    )

    expect(requestUrl).not.toBeNull()
    const url = new URL(String(requestUrl))
    expect(url.searchParams.get('size')).toBe('5')
    expect(url.searchParams.get('unreadOnly')).toBe('false')
  })

  it('marks an unread notification as read and opens its proposal', async () => {
    const user = userEvent.setup()
    const notification = makeNotification()
    let postCount = 0

    server.use(
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json(latestPage([notification])),
      ),
      http.post(`${API_BASE_URL}/notifications/${notification.id}/read`, () => {
        postCount += 1
        return HttpResponse.json({ ...notification, read: true })
      }),
    )

    renderMenu(1)
    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }))
    await screen.findByText(notification.title)
    await user.click(screen.getByRole('menuitem'))

    await waitFor(() => expect(postCount).toBe(1))
    expect(await screen.findByText('Proposal details page')).toBeInTheDocument()
  })

  it('opens a read notification without calling the read endpoint', async () => {
    const user = userEvent.setup()
    const notification = makeNotification({ entityType: 'Project', read: true })
    let postCount = 0

    server.use(
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json(latestPage([notification])),
      ),
      http.post(`${API_BASE_URL}/notifications/:id/read`, () => {
        postCount += 1
        return HttpResponse.json(notification)
      }),
    )

    renderMenu(0)
    await user.click(screen.getByRole('button', { name: 'Notifications, no unread items' }))
    await screen.findByText(notification.title)
    await user.click(screen.getByRole('menuitem'))

    expect(await screen.findByText('Project details page')).toBeInTheDocument()
    expect(postCount).toBe(0)
  })

  it('shows an honest empty state when the user has no notifications', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${API_BASE_URL}/notifications`, () =>
        HttpResponse.json(latestPage([])),
      ),
    )

    renderMenu(0)

    await user.click(screen.getByRole('button', { name: 'Notifications, no unread items' }))

    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument()
  })
})
