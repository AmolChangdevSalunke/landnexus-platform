import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import type { TokenResponse } from './types'

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1'

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  const value = typeof configured === 'string' && configured.trim() ? configured.trim() : DEFAULT_API_BASE_URL
  return value.replace(/\/+$/, '')
}

export const API_BASE_URL = resolveApiBaseUrl()

const REFRESH_TOKEN_KEY = 'ln.refresh_token'
export const SESSION_NOTICE_KEY = 'ln.session_notice'
export const NETWORK_ERROR_EVENT = 'landnexus:network-error'
export const NETWORK_OK_EVENT = 'landnexus:network-ok'

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout']

/* ------------------------------------------------------------------ */
/* In-memory access token + per-tab refresh token                      */
/* ------------------------------------------------------------------ */

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getRefreshToken(): string | null {
  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
    } else {
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  } catch {
    // Storage can be unavailable (for example private mode). The session then
    // only survives until the page is reloaded, which is acceptable.
  }
}

export function hasRefreshToken(): boolean {
  return Boolean(getRefreshToken())
}

export function clearSessionTokens(): void {
  setAccessToken(null)
  setRefreshToken(null)
}

export function setSessionNotice(message: string): void {
  try {
    window.sessionStorage.setItem(SESSION_NOTICE_KEY, message)
  } catch {
    // Ignore unavailable storage.
  }
}

export function consumeSessionNotice(): string | null {
  try {
    const message = window.sessionStorage.getItem(SESSION_NOTICE_KEY)
    if (message) {
      window.sessionStorage.removeItem(SESSION_NOTICE_KEY)
    }
    return message
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Session event bridge (store is configured by the app bootstrap)     */
/* ------------------------------------------------------------------ */

export interface SessionListener {
  onTokensRefreshed?: (tokens: TokenResponse) => void
  onSessionExpired?: () => void
}

let sessionListener: SessionListener = {}

export function configureSessionListener(listener: SessionListener): void {
  sessionListener = listener
}

function emitWindowEvent(name: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(name))
  }
}

/* ------------------------------------------------------------------ */
/* Refresh (single-flight)                                             */
/* ------------------------------------------------------------------ */

let refreshPromise: Promise<TokenResponse> | null = null

/**
 * Refreshes the session with the one-time refresh token.
 * Concurrent callers share the same promise, so the backend never sees two
 * refresh requests with the same token (which would end the user's sessions).
 */
export function refreshSession(): Promise<TokenResponse> {
  if (refreshPromise) {
    return refreshPromise
  }

  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token is stored.'))
  }

  refreshPromise = axios
    .post<TokenResponse>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 20_000 },
    )
    .then(({ data }) => {
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      sessionListener.onTokensRefreshed?.(data)
      return data
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export function expireSession(): void {
  const hadSession = Boolean(getAccessToken() || getRefreshToken())
  clearSessionTokens()
  if (hadSession) {
    setSessionNotice('Your session expired. Please sign in again.')
  }
  sessionListener.onSessionExpired?.()
}

/* ------------------------------------------------------------------ */
/* The single API client                                               */
/* ------------------------------------------------------------------ */

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = AxiosHeaders.from(config.headers)
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) {
    return false
  }
  return AUTH_ENDPOINTS_WITHOUT_REFRESH.some((path) => url.includes(path))
}

apiClient.interceptors.response.use(
  (response) => {
    emitWindowEvent(NETWORK_OK_EVENT)
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    if (!error.response) {
      emitWindowEvent(NETWORK_ERROR_EVENT)
      return Promise.reject(error)
    }

    if (error.response.status !== 401 || !error.config) {
      return Promise.reject(error)
    }

    const config = error.config as RetryableRequestConfig

    if (config._retry || isAuthEndpoint(config.url)) {
      return Promise.reject(error)
    }

    if (!getRefreshToken()) {
      expireSession()
      return Promise.reject(error)
    }

    config._retry = true

    try {
      const tokens = await refreshSession()
      config.headers = AxiosHeaders.from(config.headers)
      config.headers.set('Authorization', `Bearer ${tokens.accessToken}`)
      return await apiClient.request(config)
    } catch (refreshError) {
      expireSession()
      return Promise.reject(refreshError)
    }
  },
)

export default apiClient
