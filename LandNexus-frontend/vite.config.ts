import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '0.0.0.0' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    // userEvent-driven form tests can exceed the 5 s default when the full
    // suite runs in parallel on a busy machine.
    testTimeout: 15_000,
  },
})
