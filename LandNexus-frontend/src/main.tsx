import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { store } from './app/store'
import { bootstrapSession } from './features/auth/authSlice'
import './index.css'

// Restore the session once at startup. The access token stays in memory; only
// the per-tab refresh token is read from sessionStorage.
void store.dispatch(bootstrapSession())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)
