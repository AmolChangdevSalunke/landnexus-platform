/**
 * Date helpers for acquisition forms. The backend receives plain
 * yyyy-MM-dd local dates and ISO instants for capture timestamps.
 */

function localIsoDate(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 10)
}

/** Today as yyyy-MM-dd in the browser's local timezone. */
export function todayIso(): string {
  return localIsoDate(new Date())
}

/** Current local time formatted for an <input type="datetime-local">. */
export function nowLocalDateTime(): string {
  const shifted = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

export function isFutureDate(value: string): boolean {
  return Boolean(value) && value > todayIso()
}

/**
 * The backend rejects a capture time more than five minutes in the future.
 * The small allowance lets a phone clock drift without blocking the upload.
 */
export function isFutureCapture(value: string): boolean {
  if (!value) {
    return false
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }
  return parsed.getTime() > Date.now() + 5 * 60_000
}

export function toIsoInstant(value: string): string | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}
