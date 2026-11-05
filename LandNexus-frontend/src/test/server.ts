import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * Shared MSW server for the Vitest jsdom environment.
 *
 * Every request that is not explicitly mocked fails the test, so a screen can
 * never quietly fall back to fake data.
 */
export const server = setupServer(...handlers)
