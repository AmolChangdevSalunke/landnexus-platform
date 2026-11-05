import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { API_BASE_URL, consumeSessionNotice, getAccessToken, getRefreshToken, setRefreshToken } from '../../api/client'
import { bootstrapSession, login, logout } from './authSlice'
import { TEST_TOKENS, TEST_USER } from '../../test/handlers'
import { createTestStore } from '../../test/render'
import { server } from '../../test/server'

describe('auth thunks', () => {
  it('signs in, stores the tokens and loads the current user', async () => {
    const store = createTestStore()
    let meAuthorization: string | null = null

    server.use(
      http.get(`${API_BASE_URL}/auth/me`, ({ request }) => {
        meAuthorization = request.headers.get('authorization')
        return HttpResponse.json(TEST_USER)
      }),
    )

    const result = await store.dispatch(
      login({ username: 'consultant.one', password: 'Correct#1' }),
    )

    expect(login.fulfilled.match(result)).toBe(true)
    expect(store.getState().auth.status).toBe('authenticated')
    expect(store.getState().auth.user?.username).toBe(TEST_USER.username)
    expect(getAccessToken()).toBe(TEST_TOKENS.accessToken)
    expect(getRefreshToken()).toBe(TEST_TOKENS.refreshToken)
    expect(meAuthorization).toBe(`Bearer ${TEST_TOKENS.accessToken}`)
  })

  it('maps a failed sign in to a safe message and clears tokens', async () => {
    const store = createTestStore()

    const result = await store.dispatch(
      login({ username: 'consultant.one', password: 'wrong' }),
    )

    expect(login.rejected.match(result)).toBe(true)
    if (!login.rejected.match(result)) {
      throw new Error('Expected the login thunk to be rejected')
    }
    expect(result.payload?.message).toBe('Invalid username or password')
    expect(store.getState().auth.status).toBe('anonymous')
    expect(store.getState().auth.user).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('does not restore a session when no refresh token is stored', async () => {
    const store = createTestStore()

    const result = await store.dispatch(bootstrapSession())

    expect(bootstrapSession.fulfilled.match(result)).toBe(true)
    expect(result.payload).toBeNull()
    expect(store.getState().auth.status).toBe('anonymous')
  })

  it('restores a session from the refresh token', async () => {
    const store = createTestStore()
    setRefreshToken('seeded-refresh-token')

    const result = await store.dispatch(bootstrapSession())

    expect(bootstrapSession.fulfilled.match(result)).toBe(true)
    expect(store.getState().auth.status).toBe('authenticated')
    expect(store.getState().auth.user?.username).toBe(TEST_USER.username)
    expect(getAccessToken()).toBe(TEST_TOKENS.accessToken)
    expect(getRefreshToken()).toBe(TEST_TOKENS.refreshToken)
  })

  it('clears an unrecoverable session and leaves a sign-in notice', async () => {
    const store = createTestStore()
    setRefreshToken('already-used-refresh-token')

    server.use(
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ message: 'Invalid refresh token' }, { status: 401 }),
      ),
    )

    const result = await store.dispatch(bootstrapSession())

    expect(bootstrapSession.rejected.match(result)).toBe(true)
    expect(store.getState().auth.status).toBe('anonymous')
    expect(store.getState().auth.user).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(consumeSessionNotice()).toBe('Your session expired. Please sign in again.')
  })

  it('revokes the refresh token on the backend and clears local tokens on logout', async () => {
    const store = createTestStore({ status: 'authenticated', user: TEST_USER })
    setRefreshToken('refresh-to-revoke')
    let logoutBody: unknown = null

    server.use(
      http.post(`${API_BASE_URL}/auth/logout`, async ({ request }) => {
        logoutBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await store.dispatch(logout())

    expect(logoutBody).toEqual({ refreshToken: 'refresh-to-revoke' })
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(store.getState().auth.status).toBe('anonymous')
    expect(store.getState().auth.user).toBeNull()
  })

  it('still clears local tokens when the logout request fails', async () => {
    const store = createTestStore({ status: 'authenticated', user: TEST_USER })
    setRefreshToken('refresh-to-revoke')

    server.use(http.post(`${API_BASE_URL}/auth/logout`, () => HttpResponse.error()))

    await store.dispatch(logout())

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(store.getState().auth.status).toBe('anonymous')
  })
})
