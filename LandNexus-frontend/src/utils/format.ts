const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
})

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
})

function parse(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Timestamp in the user's locale, en-IN 24-hour format. */
export function formatDateTime(value: string | null | undefined): string {
  const date = parse(value)
  return date ? dateTimeFormatter.format(date) : '—'
}

/** Date only (yyyy-MM-dd values are treated as calendar dates). */
export function formatDate(value: string | null | undefined): string {
  const date = parse(value)
  return date ? dateFormatter.format(date) : '—'
}

/** Exact ISO timestamp for tooltips and detail views. */
export function exactTimestamp(value: string | null | undefined): string {
  const date = parse(value)
  return date ? date.toISOString() : '—'
}

export function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '—'
}

export function formatArea(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${numberFormatter.format(value)} ha`
    : '—'
}

export function formatLength(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${numberFormatter.format(value)} km`
    : '—'
}

const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

/** Indian rupee formatting. Never used to add values up in the browser. */
export function formatMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? moneyFormatter.format(value)
    : '—'
}

const percentFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
})

export function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${percentFormatter.format(value)}%`
    : '—'
}

/**
 * SLA limits and ages are stored in hours. Display them as days and hours;
 * the value sent to the server is always hours.
 */
export function formatDaysHours(hours: number | null | undefined): string {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) {
    return '—'
  }
  const wholeHours = Math.floor(hours)
  const days = Math.floor(wholeHours / 24)
  const remainder = wholeHours % 24
  const dayLabel = `${days} ${days === 1 ? 'day' : 'days'}`
  const hourLabel = `${remainder} ${remainder === 1 ? 'hour' : 'hours'}`
  return `${dayLabel} ${hourLabel}`
}

/**
 * A short, readable form of a UUID for compact places such as table cells.
 * Use the full value in a tooltip or a detail view.
 */
export function shortId(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  return value.length > 8 ? `${value.slice(0, 8)}…` : value
}
