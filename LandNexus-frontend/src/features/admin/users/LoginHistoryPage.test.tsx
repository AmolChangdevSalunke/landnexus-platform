import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { LoginHistoryPage } from './LoginHistoryPage'
import { API_BASE_URL } from '../../../api/client'
import type { LoginHistoryResponse } from '../../../api/types'
import { TEST_USER } from '../../../test/handlers'
import { renderWithProviders } from '../../../test/render'
import { server } from '../../../test/server'

const AUTH = {
  user: { ...TEST_USER, permissions: ['AUDIT_READ'] },
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

const ATTEMPTS: LoginHistoryResponse[] = [
  {
    id: 'l1',
    occurredAt: '2026-02-02T10:00:00Z',
    userId: TEST_USER.id,
    usernameAttempted: 'consultant.one',
    success: true,
    failureReason: null,
    ipAddress: '10.1.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
  {
    id: 'l2',
    occurredAt: '2026-02-01T09:00:00Z',
    userId: null,
    usernameAttempted: 'unknown.actor',
    success: false,
    failureReason: 'BAD_CREDENTIALS',
    ipAddress: '10.2.2.2',
    userAgent: null,
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

describe('LoginHistoryPage', () => {
  it('shows success and failure attempts with security details', async () => {
    server.use(
      http.get(`${API_BASE_URL}/administration/login-history`, () =>
        HttpResponse.json(page(ATTEMPTS)),
      ),
    )

    renderWithProviders(<LoginHistoryPage />, { auth: AUTH })

    await screen.findByRole('heading', { name: 'Login history' })
    expect(await screen.findByText('consultant.one')).toBeInTheDocument()
    expect(screen.getByText('unknown.actor')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Failure')).toBeInTheDocument()
    expect(screen.getByText('BAD_CREDENTIALS')).toBeInTheDocument()
    expect(screen.getByText('10.1.1.1')).toBeInTheDocument()
    expect(
      screen.getByTitle('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    ).toBeInTheDocument()
  })

  it('sends the username filter to the backend', async () => {
    const user = userEvent.setup()
    const requests: URLSearchParams[] = []

    server.use(
      http.get(`${API_BASE_URL}/administration/login-history`, ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(page(ATTEMPTS))
      }),
    )

    renderWithProviders(<LoginHistoryPage />, { auth: AUTH })
    await screen.findByText('consultant.one')

    await user.type(screen.getByLabelText('Username'), 'consultant.one')
    await user.click(screen.getByRole('button', { name: 'Apply filter' }))

    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1]?.get('username')).toBe('consultant.one')
    expect(requests[1]?.get('page')).toBe('0')
  })
})
