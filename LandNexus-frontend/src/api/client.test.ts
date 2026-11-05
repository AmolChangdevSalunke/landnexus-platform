import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import {
  API_BASE_URL,
  NETWORK_ERROR_EVENT,
  NETWORK_OK_EVENT,
  apiClient,
  configureSessionListener,
  consumeSessionNotice,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './client'
import { TEST_TOKENS, TEST_USER } from '../test/handlers'
import { server } from '../test/server'

describe('apiClient request authorization', () => {
  it('attaches the in-memory bearer token and keeps it out of storage', async () => {
    setAccessToken('memory-access-token')
    let received: string | null = null

    server.use(
      http.get(`${API_BASE_URL}/auth/me`, ({ request }) => {
        received = request.headers.get('authorization')
        return HttpResponse.json(TEST_USER)
      }),
    )

    const { data } = await apiClient.get('/auth/me')

    expect(received).toBe('Bearer memory-access-token')
    expect(data.username).toBe(TEST_USER.username)
    expect(window.sessionStorage.getItem('ln.access_token')).toBeNull()
    expect(window.sessionStorage.getItem('ln.refresh_token')).toBeNull()
  })

  it('sends no Authorization header when there is no access token', async () => {
    let received: string | null = 'not-set'

    server.use(
      http.get(`${API_BASE_URL}/auth/me`, ({ request }) => {
        received = request.headers.get('authorization')
        return HttpResponse.json(TEST_USER)
      }),
    )

    await apiClient.get('/auth/me')

    expect(received).toBeNull()
  })
})

describe('apiClient 401 refresh handling', () => {
  it('refreshes once for concurrent 401 responses and retries them', async () => {
    let refreshCalls = 0
    setAccessToken('expired-access-token')
    setRefreshToken('stored-refresh-token')

    server.use(
      http.get(`${API_BASE_URL}/secure`, ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer new-access-token') {
          return new HttpResponse(null, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
      http.post(`${API_BASE_URL}/auth/refresh`, async () => {
        refreshCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
        return HttpResponse.json({
          ...TEST_TOKENS,
          accessToken: 'new-access-token',
          refreshToken: 'rotated-refresh-token',
        })
      }),
    )

    const responses = await Promise.all([
      apiClient.get<{ ok: boolean }>('/secure'),
      apiClient.get<{ ok: boolean }>('/secure'),
      apiClient.get<{ ok: boolean }>('/secure'),
    ])

    expect(refreshCalls).toBe(1)
    expect(responses.map((response) => response.data.ok)).toEqual([true, true, true])
    expect(getAccessToken()).toBe('new-access-token')
    expect(getRefreshToken()).toBe('rotated-refresh-token')
  })

  it('notifies the store when tokens are refreshed', async () => {
    const onTokensRefreshed = vi.fn()
    configureSessionListener({ onTokensRefreshed })
    setAccessToken('expired')
    setRefreshToken('refresh')

    server.use(
      http.get(`${API_BASE_URL}/secure`, ({ request }) => {
        if (request.headers.get('authorization') === 'Bearer new-access-token') {
          return HttpResponse.json({ ok: true })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ ...TEST_TOKENS, accessToken: 'new-access-token' }),
      ),
    )

    await apiClient.get('/secure')

    expect(onTokensRefreshed).toHaveBeenCalledTimes(1)
  })

  it('expires the local session when the refresh token is rejected', async () => {
    const onSessionExpired = vi.fn()
    configureSessionListener({ onSessionExpired })
    setAccessToken('expired')
    setRefreshToken('already-used-refresh-token')

    server.use(
      http.get(`${API_BASE_URL}/secure`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ message: 'Invalid refresh token' }, { status: 401 }),
      ),
    )

    await expect(apiClient.get('/secure')).rejects.toBeTruthy()

    expect(onSessionExpired).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(consumeSessionNotice()).toBe('Your session expired. Please sign in again.')
  })

  it('expires the session without calling refresh when no refresh token exists', async () => {
    let refreshCalls = 0
    setAccessToken('expired')

    server.use(
      http.get(`${API_BASE_URL}/secure`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/refresh`, () => {
        refreshCalls += 1
        return HttpResponse.json(TEST_TOKENS)
      }),
    )

    await expect(apiClient.get('/secure')).rejects.toBeTruthy()

    expect(refreshCalls).toBe(0)
    expect(getAccessToken()).toBeNull()
    expect(consumeSessionNotice()).toBe('Your session expired. Please sign in again.')
  })

  it('does not try to refresh a failed login request', async () => {
    let refreshCalls = 0

    server.use(
      http.post(`${API_BASE_URL}/auth/login`, () =>
        HttpResponse.json({ message: 'Bad credentials' }, { status: 401 }),
      ),
      http.post(`${API_BASE_URL}/auth/refresh`, () => {
        refreshCalls += 1
        return HttpResponse.json(TEST_TOKENS)
      }),
    )

    await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy()

    expect(refreshCalls).toBe(0)
  })
})

describe('apiClient network events', () => {
  it('emits a network error event when the backend cannot be reached', async () => {
    const onNetworkError = vi.fn()
    window.addEventListener(NETWORK_ERROR_EVENT, onNetworkError)

    server.use(http.get(`${API_BASE_URL}/secure`, () => HttpResponse.error()))

    await expect(apiClient.get('/secure')).rejects.toBeTruthy()

    expect(onNetworkError).toHaveBeenCalledTimes(1)
    window.removeEventListener(NETWORK_ERROR_EVENT, onNetworkError)
  })

  it('emits a recovery event after a successful response', async () => {
    const onNetworkOk = vi.fn()
    window.addEventListener(NETWORK_OK_EVENT, onNetworkOk)

    await apiClient.get('/auth/me')

    expect(onNetworkOk).toHaveBeenCalledTimes(1)
    window.removeEventListener(NETWORK_OK_EVENT, onNetworkOk)
  })
})

describe('session notice storage', () => {
  it('is consumed exactly once', () => {
    window.sessionStorage.setItem('ln.session_notice', 'Session ended')

    expect(consumeSessionNotice()).toBe('Session ended')
    expect(consumeSessionNotice()).toBeNull()
  })
})
