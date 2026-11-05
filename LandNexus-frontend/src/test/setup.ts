import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { clearSessionTokens, configureSessionListener } from '../api/client'
import { server } from './server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  window.sessionStorage.clear()
  clearSessionTokens()
  configureSessionListener({})
})

afterAll(() => {
  server.close()
})
