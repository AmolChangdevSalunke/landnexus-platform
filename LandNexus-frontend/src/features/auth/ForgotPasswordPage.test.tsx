import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { API_BASE_URL } from '../../api/client'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'

const STRONG_PASSWORD = 'NewPassword123'

describe('ForgotPasswordPage', () => {
  it('submits the one-time code and new password without a session', async () => {
    let received: unknown = null
    server.use(
      http.post(`${API_BASE_URL}/auth/reset-password`, async ({ request }) => {
        received = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<ForgotPasswordPage />, { auth: { status: 'anonymous' } })

    await user.type(screen.getByLabelText(/Reset code/), 'one-time-code')
    await user.type(screen.getByLabelText(/^New password/), STRONG_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm new password/), STRONG_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument()
    expect(received).toEqual({ code: 'one-time-code', newPassword: STRONG_PASSWORD })
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
  })

  it('refuses mismatched passwords before calling the API', async () => {
    let calls = 0
    server.use(
      http.post(`${API_BASE_URL}/auth/reset-password`, () => {
        calls += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<ForgotPasswordPage />, { auth: { status: 'anonymous' } })

    await user.type(screen.getByLabelText(/Reset code/), 'one-time-code')
    await user.type(screen.getByLabelText(/^New password/), STRONG_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm new password/), 'DifferentPassword123')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('The two new passwords do not match.')).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('shows the backend message for an invalid or expired code', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/reset-password`, () =>
        HttpResponse.json(
          {
            timestamp: '2026-11-15T10:00:00Z',
            status: 400,
            error: 'Bad Request',
            message: 'The reset code is invalid or has expired',
            path: '/api/v1/auth/reset-password',
            fieldErrors: [],
          },
          { status: 400 },
        ),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<ForgotPasswordPage />, { auth: { status: 'anonymous' } })

    await user.type(screen.getByLabelText(/Reset code/), 'expired')
    await user.type(screen.getByLabelText(/^New password/), STRONG_PASSWORD)
    await user.type(screen.getByLabelText(/Confirm new password/), STRONG_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(
      await screen.findByText('The reset code is invalid or has expired'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Password changed' })).not.toBeInTheDocument()
  })
})
