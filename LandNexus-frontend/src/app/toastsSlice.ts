import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  variant: ToastVariant
  title?: string
  message: string
}

interface ToastsState {
  items: ToastMessage[]
}

const initialState: ToastsState = {
  items: [],
}

type NewToast = Omit<ToastMessage, 'id'>

const toastsSlice = createSlice({
  name: 'toasts',
  initialState,
  reducers: {
    addToast: {
      reducer(state, action: PayloadAction<ToastMessage>) {
        state.items = [action.payload, ...state.items].slice(0, 5)
      },
      prepare(toast: NewToast) {
        return { payload: { ...toast, id: nanoid() } }
      },
    },
    removeToast(state, action: PayloadAction<string>) {
      state.items = state.items.filter((toast) => toast.id !== action.payload)
    },
  },
})

export const { addToast, removeToast } = toastsSlice.actions
export default toastsSlice.reducer
