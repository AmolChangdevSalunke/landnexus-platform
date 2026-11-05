import { configureStore } from '@reduxjs/toolkit'
import { configureSessionListener } from '../api/client'
import authReducer, { sessionExpired, tokensRefreshed } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import toastsReducer from './toastsSlice'

export function createAppStore() {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      notifications: notificationsReducer,
      toasts: toastsReducer,
    },
  })

  configureSessionListener({
    onTokensRefreshed: (tokens) => {
      store.dispatch(tokensRefreshed(tokens))
    },
    onSessionExpired: () => {
      store.dispatch(sessionExpired())
    },
  })

  return store
}

export const store = createAppStore()

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
