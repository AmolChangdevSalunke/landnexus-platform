import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureLogging,
  createLogger,
  formatTimestamp,
  installGlobalErrorHandlers,
  isLogLevelEnabled,
  newRequestId,
  resetLogging,
  sanitize,
  type LogEntry,
} from './logger'

afterEach(() => {
  resetLogging()
  vi.restoreAllMocks()
})

describe('frontend logger', () => {
  it('is silent by default in the test environment', () => {
    const entries: LogEntry[] = []
    configureLogging({ sink: (entry) => entries.push(entry) })

    createLogger('test').error('should not appear')

    expect(entries).toHaveLength(0)
    expect(isLogLevelEnabled('error')).toBe(false)
  })

  it('filters by configured level', () => {
    const entries: LogEntry[] = []
    configureLogging({ level: 'warn', environment: 'dev', sink: (entry) => entries.push(entry) })
    const log = createLogger('test')

    log.debug('debug hidden')
    log.info('info hidden')
    log.warn('warn visible')
    log.error('error visible')

    expect(entries.map((entry) => entry.level)).toEqual(['warn', 'error'])
  })

  it('captures structured context without secrets', () => {
    const entries: LogEntry[] = []
    configureLogging({ level: 'debug', environment: 'dev', sink: (entry) => entries.push(entry) })

    createLogger('api.client').info('API request completed token=abc123', {
      requestId: 'req-123',
      userId: 'user-1',
      method: 'GET',
      endpoint: '/api/v1/projects?token=secret',
      status: 200,
      durationMs: 12.4,
      error: new Error('password=hunter2'),
    })

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.service).toBe('landnexus-ui')
    expect(entry.environment).toBe('dev')
    expect(entry.requestId).toBe('req-123')
    expect(entry.userId).toBe('user-1')
    expect(entry.endpoint).toBe('/api/v1/projects')
    expect(entry.status).toBe(200)
    expect(entry.durationMs).toBe(12)
    expect(entry.message).not.toContain('abc123')
    expect(entry.error?.message).not.toContain('hunter2')
  })

  it('prints Spring Boot-style lines in development', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    configureLogging({ level: 'info', environment: 'dev' })

    createLogger('property').info('Property request received', {
      requestId: 'req-42',
      method: 'GET',
      endpoint: '/api/v1/properties/1',
      status: 200,
      durationMs: 8,
    })

    const line = info.mock.calls[0][0] as string
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2} INFO {2}web --- \[landnexus-ui\] \[main\] \[req-42\] property : Property request received/)
    expect(line).toContain('[GET /api/v1/properties/1 -> 200 (8 ms)]')
  })

  it('prints JSON in production and hides info-level chatter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    configureLogging({ level: 'warn', environment: 'prod' })
    const log = createLogger('api.client')

    log.info('not in production')
    log.warn('API request failed', { requestId: 'req-9', status: 500, endpoint: '/api/v1/projects' })

    expect(info).not.toHaveBeenCalled()
    const payload = JSON.parse(warn.mock.calls[0][0] as string)
    expect(payload).toMatchObject({
      level: 'WARN',
      service: 'landnexus-ui',
      environment: 'prod',
      module: 'api.client',
      requestId: 'req-9',
      status: 500,
      endpoint: '/api/v1/projects',
    })
  })

  it('never lets logging failures escape', () => {
    configureLogging({
      level: 'debug',
      environment: 'dev',
      sink: () => {
        throw new Error('sink failed')
      },
    })

    expect(() => createLogger('test').info('safe')).not.toThrow()
  })

  it('sanitizes injected lines, bearer tokens, JWTs and e-mail addresses', () => {
    const cleaned = sanitize(
      'alice@example.com\r\nINFO forged Bearer abc.def.ghi token=secret '
        + 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123',
    )

    expect(cleaned).not.toContain('\n')
    expect(cleaned).not.toContain('abc.def.ghi')
    expect(cleaned).not.toContain('secret')
    expect(cleaned).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(cleaned).toContain('a***@example.com')
  })

  it('formats a timestamp with milliseconds and a numeric offset', () => {
    expect(formatTimestamp(new Date('2026-11-18T18:13:10.125Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    )
  })

  it('creates unique request ids', () => {
    expect(newRequestId()).toMatch(/^req-/)
    expect(newRequestId()).not.toBe(newRequestId())
  })

  it('reports unhandled browser errors through the logger', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    configureLogging({ level: 'error', environment: 'dev' })
    installGlobalErrorHandlers()

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('boom'), message: 'boom' }))
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown }
    rejection.reason = new Error('rejected')
    window.dispatchEvent(rejection)

    expect(error).toHaveBeenCalledTimes(2)
  })
})
