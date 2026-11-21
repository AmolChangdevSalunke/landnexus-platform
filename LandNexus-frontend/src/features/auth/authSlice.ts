import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  hasRefreshToken,
  refreshSession,
  setAccessToken,
  setRefreshToken,
  setSessionNotice,
} from '../../api/client'
import { fetchCurrentUser, loginRequest, logoutRequest } from '../../api/auth'
import { toApiErrorInfo, type ApiErrorInfo } from '../../api/errors'
import { createLogger } from '../../logging/logger'
import type { CurrentUser, LoginRequest, TokenResponse } from '../../api/types'

const log = createLogger('auth')

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

export interface AuthState {
  user: CurrentUser | null
  accessToken: string | null
  status: AuthStatus
  error: string | null
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: 'idle',
  error: null,
}

export const bootstrapSession = createAsyncThunk<
  CurrentUser | null,
  void,
  { rejectValue: ApiErrorInfo }
>('auth/bootstrap', async (_arg, { rejectWithValue }) => {
  if (!hasRefreshToken()) {
    log.debug('No stored session to restore')
    return null
  }

  try {
    await refreshSession()
    const user = await fetchCurrentUser()
    log.info('Session restored', { userId: user.id })
    return user
  } catch (error) {
    clearSessionTokens()
    setSessionNotice('Your session expired. Please sign in again.')
    log.warn('Session restore failed', { error })
    return rejectWithValue(toApiErrorInfo(error))
  }
})

export const login = createAsyncThunk<
  { user: CurrentUser; tokens: TokenResponse },
  LoginRequest,
  { rejectValue: ApiErrorInfo }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const tokens = await loginRequest(credentials)
    setAccessToken(tokens.accessToken)
    setRefreshToken(tokens.refreshToken)
    const user = await fetchCurrentUser()
    log.info('Login succeeded', { userId: user.id })
    return { user, tokens }
  } catch (error) {
    clearSessionTokens()
    const info = toApiErrorInfo(error)
    log.warn('Login failed', { status: info.status })
    return rejectWithValue(
      info.status === 401 ? { ...info, message: 'Invalid username or password' } : info,
    )
  }
})

export const logout = createAsyncThunk<void, void>('auth/logout', async () => {
  const refreshToken = getRefreshToken()
  if (refreshToken) {
    try {
      await logoutRequest(refreshToken)
    } catch {
      // Logout always succeeds locally, even when the backend is unreachable.
    }
  }
  clearSessionTokens()
  log.info('Logout completed')
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    tokensRefreshed(state, action: PayloadAction<TokenResponse>) {
      state.accessToken = action.payload.accessToken
      state.error = null
    },
    sessionExpired(state) {
      state.user = null
      state.accessToken = null
      state.status = 'anonymous'
      state.error = 'Your session expired. Please sign in again.'
    },
    clearAuthError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapSession.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload
          state.accessToken = getAccessToken()
          state.status = 'authenticated'
        } else {
          state.user = null
          state.accessToken = null
          state.status = 'anonymous'
        }
        state.error = null
      })
      .addCase(bootstrapSession.rejected, (state, action) => {
        state.user = null
        state.accessToken = null
        state.status = 'anonymous'
        state.error = action.payload?.message ?? 'Your session could not be restored.'
      })
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.accessToken = action.payload.tokens.accessToken
        state.status = 'authenticated'
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.user = null
        state.accessToken = null
        state.status = 'anonymous'
        state.error = action.payload?.message ?? 'Sign in failed. Please try again.'
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.accessToken = null
        state.status = 'anonymous'
        state.error = null
      })
  },
})

export const { tokensRefreshed, sessionExpired, clearAuthError } = authSlice.actions
export default authSlice.reducer
