import type { ReactElement, ReactNode } from 'react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import authReducer, { type AuthState } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import toastsReducer from '../app/toastsSlice'

const ANONYMOUS_AUTH: AuthState = {
  user: null,
  accessToken: null,
  status: 'anonymous',
  error: null,
}

/** A store with the real reducers and an explicit auth state for a test. */
export function createTestStore(auth: Partial<AuthState> = {}) {
  return configureStore({
    reducer: {
      auth: authReducer,
      notifications: notificationsReducer,
      toasts: toastsReducer,
    },
    preloadedState: {
      auth: { ...ANONYMOUS_AUTH, ...auth },
    },
  })
}

export type TestStore = ReturnType<typeof createTestStore>

export function renderWithProviders(
  ui: ReactElement,
  options: {
    auth?: Partial<AuthState>
    initialEntries?: string[]
    store?: TestStore
  } = {},
): ReturnType<typeof render> & { store: TestStore } {
  const store = options.store ?? createTestStore(options.auth)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>{children}</MemoryRouter>
    </Provider>
  )

  return Object.assign(render(ui, { wrapper }), { store })
}
