import axios from 'axios'
import type { ApiError, ApiFieldError } from './types'

export interface ApiErrorInfo {
  /** HTTP status, or 0 for a network / unknown error. */
  status: number
  message: string
  fieldErrors: ApiFieldError[]
  isNetworkError: boolean
}

const NETWORK_MESSAGE =
  'We cannot reach the server. Check your network connection and try again.'
const UNEXPECTED_MESSAGE = 'Something went wrong. Please try again.'
const SERVER_MESSAGE = 'The server could not complete the request. Please try again later.'
const UNAUTHORIZED_MESSAGE = 'Your session has expired. Please sign in again.'
const FORBIDDEN_MESSAGE = 'You do not have permission to do this.'
const NOT_FOUND_MESSAGE = 'The requested record was not found.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readFieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry): ApiFieldError[] => {
    if (!isRecord(entry)) {
      return []
    }
    const field = entry.field
    const message = entry.message
    if (typeof field !== 'string' || typeof message !== 'string') {
      return []
    }
    return [{ field, message }]
  })
}

function readApiErrorPayload(value: unknown): {
  message: string
  fieldErrors: ApiFieldError[]
} | null {
  if (!isRecord(value)) {
    return null
  }

  const message = typeof value.message === 'string' ? value.message : null
  const fieldErrors = readFieldErrors(value.fieldErrors)

  if (message === null && fieldErrors.length === 0) {
    return null
  }

  return { message: message ?? '', fieldErrors }
}

/**
 * Converts any thrown value into a safe, user-facing error.
 * This is the only place where Axios errors should be interpreted.
 */
export function toApiErrorInfo(error: unknown): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return {
        status: 0,
        message: NETWORK_MESSAGE,
        fieldErrors: [],
        isNetworkError: true,
      }
    }

    const status = error.response.status
    const payload = readApiErrorPayload(error.response.data)
    const serverMessage = payload?.message.trim() ?? ''
    const fieldErrors = payload?.fieldErrors ?? []

    switch (status) {
      case 400:
        return {
          status,
          message: serverMessage || 'Please check the highlighted fields and try again.',
          fieldErrors,
          isNetworkError: false,
        }
      case 401:
        return {
          status,
          message: UNAUTHORIZED_MESSAGE,
          fieldErrors: [],
          isNetworkError: false,
        }
      case 403:
        return {
          status,
          message: FORBIDDEN_MESSAGE,
          fieldErrors: [],
          isNetworkError: false,
        }
      case 404:
        return {
          status,
          message: serverMessage || NOT_FOUND_MESSAGE,
          fieldErrors: [],
          isNetworkError: false,
        }
      case 409:
        return {
          status,
          message:
            serverMessage ||
            'This record changed or the action is no longer allowed. Reload and try again.',
          fieldErrors: [],
          isNetworkError: false,
        }
      case 500:
        return {
          status,
          message: SERVER_MESSAGE,
          fieldErrors: [],
          isNetworkError: false,
        }
      default:
        return {
          status,
          message: serverMessage || UNEXPECTED_MESSAGE,
          fieldErrors,
          isNetworkError: false,
        }
    }
  }

  return {
    status: 0,
    message: UNEXPECTED_MESSAGE,
    fieldErrors: [],
    isNetworkError: false,
  }
}

export function getFieldError(info: ApiErrorInfo, field: string): string | undefined {
  return info.fieldErrors.find((entry) => entry.field === field)?.message
}

/** Type guard for a raw backend error body (used by the API client tests). */
export function isApiError(value: unknown): value is ApiError {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.timestamp === 'string' &&
    typeof value.status === 'number' &&
    typeof value.error === 'string' &&
    typeof value.message === 'string' &&
    typeof value.path === 'string' &&
    Array.isArray(value.fieldErrors)
  )
}
