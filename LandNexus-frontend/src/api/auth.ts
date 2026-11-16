import axios from 'axios'
import { API_BASE_URL, apiClient } from './client'
import type { CurrentUser, LoginRequest, TokenResponse } from './types'

/**
 * Public auth calls use bare Axios requests on purpose: they must never trigger
 * the 401 refresh interceptor (a failed login is not an expired session).
 */
export async function loginRequest(body: LoginRequest): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(`${API_BASE_URL}/auth/login`, body, {
    timeout: 20_000,
  })
  return data
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await axios.post(
    `${API_BASE_URL}/auth/logout`,
    { refreshToken },
    {
      timeout: 10_000,
    },
  )
}

/**
 * Completes a password reset with the one-time code an administrator issued.
 * The endpoint is public and never requires a session.
 */
export async function resetPasswordRequest(code: string, newPassword: string): Promise<void> {
  await axios.post(
    `${API_BASE_URL}/auth/reset-password`,
    { code, newPassword },
    { timeout: 20_000 },
  )
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await apiClient.get<CurrentUser>('/auth/me')
  return data
}
