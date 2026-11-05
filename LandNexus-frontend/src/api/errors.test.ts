import { describe, expect, it } from 'vitest'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { getFieldError, toApiErrorInfo } from './errors'

function config(): InternalAxiosRequestConfig {
  return { headers: {} } as InternalAxiosRequestConfig
}

function axiosErrorWithStatus(status: number, data?: unknown): AxiosError {
  const requestConfig = config()
  const response = {
    data,
    status,
    statusText: '',
    headers: {},
    config: requestConfig,
  } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', requestConfig, undefined, response)
}

describe('toApiErrorInfo', () => {
  it('maps a missing response to a network error', () => {
    const info = toApiErrorInfo(new AxiosError('Network Error', 'ERR_NETWORK', config()))

    expect(info.status).toBe(0)
    expect(info.isNetworkError).toBe(true)
    expect(info.message).toContain('cannot reach the server')
  })

  it('keeps backend field errors for 400 responses', () => {
    const info = toApiErrorInfo(
      axiosErrorWithStatus(400, {
        timestamp: '2026-01-01T00:00:00Z',
        status: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        path: '/api/v1/proposals',
        fieldErrors: [{ field: 'title', message: 'must not be blank' }],
      }),
    )

    expect(info.status).toBe(400)
    expect(info.message).toBe('Validation failed')
    expect(info.fieldErrors).toHaveLength(1)
    expect(getFieldError(info, 'title')).toBe('must not be blank')
    expect(getFieldError(info, 'districtId')).toBeUndefined()
  })

  it('uses a generic message for 400 when the backend sends none', () => {
    const info = toApiErrorInfo(axiosErrorWithStatus(400, {}))

    expect(info.message).toBe('Please check the highlighted fields and try again.')
  })

  it('never exposes backend 401 details', () => {
    const info = toApiErrorInfo(
      axiosErrorWithStatus(401, { message: 'JWT expired at ...' }),
    )

    expect(info.status).toBe(401)
    expect(info.message).toBe('Your session has expired. Please sign in again.')
    expect(info.fieldErrors).toEqual([])
  })

  it('maps 403 to a permission message', () => {
    const info = toApiErrorInfo(axiosErrorWithStatus(403, { message: 'Access Denied' }))

    expect(info.status).toBe(403)
    expect(info.message).toBe('You do not have permission to do this.')
  })

  it('maps 404 and 409 to safe messages', () => {
    const notFound = toApiErrorInfo(axiosErrorWithStatus(404, {}))
    const conflict = toApiErrorInfo(axiosErrorWithStatus(409, {}))

    expect(notFound.message).toBe('The requested record was not found.')
    expect(conflict.message).toBe(
      'This record changed or the action is no longer allowed. Reload and try again.',
    )
  })

  it('hides server details for 500 responses', () => {
    const info = toApiErrorInfo(
      axiosErrorWithStatus(500, { message: 'org.postgresql.util.PSQLException' }),
    )

    expect(info.message).toBe('The server could not complete the request. Please try again later.')
  })

  it('passes through a backend message for other statuses', () => {
    const info = toApiErrorInfo(
      axiosErrorWithStatus(422, { message: 'Unprocessable content', fieldErrors: [] }),
    )

    expect(info.status).toBe(422)
    expect(info.message).toBe('Unprocessable content')
  })

  it('handles values that are not Axios errors', () => {
    const info = toApiErrorInfo(new Error('boom'))

    expect(info.status).toBe(0)
    expect(info.isNetworkError).toBe(false)
    expect(info.message).toBe('Something went wrong. Please try again.')
  })
})
