import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface NotificationsState {
  unreadCount: number
  /** True once the backend has answered the unread-count request. */
  hasLoaded: boolean
  /** Bumped when a workflow action should refresh the unread badge. */
  refreshRevision: number
}

const initialState: NotificationsState = {
  unreadCount: 0,
  hasLoaded: false,
  refreshRevision: 0,
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = Math.max(0, action.payload)
      state.hasLoaded = true
    },
    decrementUnreadCount(state) {
      state.unreadCount = Math.max(0, state.unreadCount - 1)
      state.hasLoaded = true
    },
    resetUnreadCount(state) {
      state.unreadCount = 0
      state.hasLoaded = false
    },
    requestUnreadRefresh(state) {
      state.refreshRevision += 1
    },
  },
})

export const {
  setUnreadCount,
  decrementUnreadCount,
  resetUnreadCount,
  requestUnreadRefresh,
} = notificationsSlice.actions
export default notificationsSlice.reducer
