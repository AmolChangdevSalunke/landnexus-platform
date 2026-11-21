/**
 * Central frontend logger.
 *
 * Development prints Spring Boot-style lines to the browser console:
 *   2026-11-18T23:43:10.125+05:30 INFO  web --- [landnexus-ui] [main] [req-123] api.client : ...
 *
 * Production prints one JSON object per event and defaults to WARN, so routine navigation does not flood the
 * console. Tests are silent unless a sink is configured explicitly. Tokens, passwords, credentials, e-mail
 * local parts and control characters are removed before anything reaches a sink.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogEnvironment = 'dev' | 'prod' | 'test'

export interface LogError {
  name: string
  message: string
  stack?: string
}

export interface LogContext {
  requestId?: string
  userId?: string
  method?: string
  endpoint?: string
  status?: number
  durationMs?: number
  error?: unknown
  /** Short, non-sensitive detail. Never pass request or response bodies. */
  detail?: string
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  service: 'landnexus-ui'
  environment: LogEnvironment
  module: string
  message: string
  thread: 'main'
  requestId?: string
  userId?: string
  method?: string
  endpoint?: string
  status?: number
  durationMs?: number
  error?: LogError
  detail?: string
}

export interface Logger {
  trace(message: string, context?: LogContext): void
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  fatal(message: string, context?: LogContext): void
}

interface LoggerConfiguration {
  level: LogLevel | 'silent'
  environment: LogEnvironment
  sink: (entry: LogEntry) => void
}

const LEVEL_WEIGHT: Record<LogLevel | 'silent', number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
}

const MAX_MESSAGE = 500
const MAX_STACK = 4000

function resolveEnvironment(): LogEnvironment {
  if (import.meta.env.MODE === 'test') {
    return 'test'
  }
  return import.meta.env.PROD ? 'prod' : 'dev'
}

function resolveDefaultLevel(environment: LogEnvironment): LogLevel | 'silent' {
  const configured = import.meta.env.VITE_LOG_LEVEL
  if (typeof configured === 'string' && configured.toLowerCase() in LEVEL_WEIGHT) {
    return configured.toLowerCase() as LogLevel
  }
  if (environment === 'test') {
    return 'silent'
  }
  return environment === 'prod' ? 'warn' : 'debug'
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0')
}

/** Local time with milliseconds and an explicit numeric offset, matching the backend console format. */
export function formatTimestamp(date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
    + `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}

/** Removes line breaks/control characters and redacts common secret spellings. */
export function sanitize(value: string): string {
  let cleaned = value.replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  cleaned = cleaned.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
  cleaned = cleaned.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED_JWT]')
  cleaned = cleaned.replace(
    /(token|password|passwd|secret|api[_-]?key|authorization|refreshToken|accessToken)\s*[=:]\s*[^\s,&;]+/gi,
    '$1=[REDACTED]',
  )
  cleaned = cleaned.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1***$2')
  return cleaned.length > MAX_MESSAGE ? cleaned.slice(0, MAX_MESSAGE) : cleaned
}

function sanitizeOptional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : sanitize(value)
}

function toLogError(error: unknown, environment: LogEnvironment): LogError | undefined {
  if (error === undefined || error === null) {
    return undefined
  }
  if (error instanceof Error) {
    const stack = environment === 'dev' ? sanitize(error.stack ?? '') : undefined
    return {
      name: sanitize(error.name || 'Error'),
      message: sanitize(error.message || 'Unknown error'),
      ...(stack ? { stack: stack.slice(0, MAX_STACK) } : {}),
    }
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: sanitize(error) }
  }
  return { name: 'Error', message: 'Non-Error value rejected or thrown' }
}

function buildEntry(module: string, level: LogLevel, message: string, context: LogContext | undefined,
                    configuration: LoggerConfiguration): LogEntry {
  const error = toLogError(context?.error, configuration.environment)
  return {
    timestamp: formatTimestamp(),
    level,
    service: 'landnexus-ui',
    environment: configuration.environment,
    module: sanitize(module) || 'app',
    message: sanitize(message),
    thread: 'main',
    ...(context?.requestId ? { requestId: sanitize(context.requestId) } : {}),
    ...(context?.userId ? { userId: sanitize(context.userId) } : {}),
    ...(context?.method ? { method: sanitize(context.method) } : {}),
    ...(context?.endpoint ? { endpoint: sanitize(context.endpoint.split('?')[0]) } : {}),
    ...(context?.status !== undefined ? { status: context.status } : {}),
    ...(context?.durationMs !== undefined ? { durationMs: Math.max(0, Math.round(context.durationMs)) } : {}),
    ...(error ? { error } : {}),
    ...(sanitizeOptional(context?.detail) ? { detail: sanitizeOptional(context?.detail) } : {}),
  }
}

function formatConsoleLine(entry: LogEntry): string {
  const level = entry.level.toUpperCase().padEnd(5)
  const requestId = entry.requestId ?? 'system'
  let line = `${entry.timestamp} ${level} web --- [landnexus-ui] [main] [${requestId}] ${entry.module} : ${entry.message}`
  if (entry.method && entry.endpoint) {
    line += ` [${entry.method} ${entry.endpoint}`
    if (entry.status !== undefined) {
      line += ` -> ${entry.status}`
    }
    if (entry.durationMs !== undefined) {
      line += ` (${entry.durationMs} ms)`
    }
    line += ']'
  } else if (entry.endpoint) {
    line += ` [${entry.endpoint}]`
  }
  if (entry.userId) {
    line += ` user=${entry.userId}`
  }
  if (entry.detail) {
    line += ` detail=${entry.detail}`
  }
  if (entry.error) {
    line += ` error=${entry.error.name}: ${entry.error.message}`
    if (entry.error.stack) {
      line += `\n${entry.error.stack}`
    }
  }
  return line
}

function writeToConsole(entry: LogEntry): void {
  const method = entry.level === 'error' || entry.level === 'fatal'
    ? 'error'
    : entry.level === 'warn' ? 'warn' : entry.level === 'info' ? 'info' : 'debug'
  if (entry.environment === 'prod') {
    const { service, environment, thread, ...rest } = entry
    console[method](JSON.stringify({
      ...rest,
      level: entry.level.toUpperCase(),
      service,
      environment,
      thread,
    }))
    return
  }
  console[method](formatConsoleLine(entry))
}

const environment = resolveEnvironment()
let configuration: LoggerConfiguration = {
  environment,
  level: resolveDefaultLevel(environment),
  sink: writeToConsole,
}

/** Intended for bootstrap and tests. Passing a sink captures entries instead of writing to the console. */
export function configureLogging(options: Partial<Pick<LoggerConfiguration, 'level' | 'sink' | 'environment'>>): void {
  configuration = {
    environment: options.environment ?? configuration.environment,
    level: options.level ?? configuration.level,
    sink: options.sink ?? configuration.sink,
  }
}

export function resetLogging(): void {
  configuration = {
    environment,
    level: resolveDefaultLevel(environment),
    sink: writeToConsole,
  }
}

export function isLogLevelEnabled(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[configuration.level]
}

function emit(module: string, level: LogLevel, message: string, context?: LogContext): void {
  if (!isLogLevelEnabled(level)) {
    return
  }
  try {
    configuration.sink(buildEntry(module, level, message, context, configuration))
  } catch {
    // Logging must never break the application. There is nowhere safe left to report this failure.
  }
}

export function createLogger(module: string): Logger {
  return {
    trace: (message, context) => emit(module, 'trace', message, context),
    debug: (message, context) => emit(module, 'debug', message, context),
    info: (message, context) => emit(module, 'info', message, context),
    warn: (message, context) => emit(module, 'warn', message, context),
    error: (message, context) => emit(module, 'error', message, context),
    fatal: (message, context) => emit(module, 'fatal', message, context),
  }
}

let requestCounter = 0

/** Correlation id for one browser request; the backend echoes it in the X-Request-Id response header. */
export function newRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) {
    return `req-${uuid}`
  }
  requestCounter += 1
  return `req-${Date.now().toString(36)}-${requestCounter}`
}

export const logger = createLogger('app')

/** Last-resort handlers for errors that escape React and every promise chain. */
export function installGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.addEventListener('error', (event) => {
    logger.error('Unhandled window error', { error: event.error ?? event.message })
  })
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', { error: event.reason })
  })
}
