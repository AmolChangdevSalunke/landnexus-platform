import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../api/client'
import type { CurrentUser, TokenResponse } from '../api/types'

export const TEST_USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'consultant.one',
  fullName: 'Consultant One',
  email: 'consultant.one@example.gov.in',
  roles: ['CONSULTANT'],
  permissions: ['PROPOSAL_CREATE', 'PROPOSAL_READ_OWN'],
}

export const TEST_TOKENS: TokenResponse = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  tokenType: 'Bearer',
  expiresInSeconds: 900,
}

function emptyPage(size = 20) {
  return { content: [], page: 0, size, totalElements: 0, totalPages: 0 }
}

/**
 * Default happy-path handlers. Individual tests override these with server.use.
 * They mirror the real backend paths only, never invented endpoints.
 */
export const handlers = [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string }
    if (body.username === 'consultant.one' && body.password === 'Correct#1') {
      return HttpResponse.json(TEST_TOKENS)
    }
    return HttpResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 401,
        error: 'Unauthorized',
        message: 'Bad credentials',
        path: '/api/v1/auth/login',
        fieldErrors: [],
      },
      { status: 401 },
    )
  }),

  http.post(`${API_BASE_URL}/auth/refresh`, () => HttpResponse.json(TEST_TOKENS)),

  http.post(`${API_BASE_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json(TEST_USER)),

  http.get(`${API_BASE_URL}/notifications/unread-count`, () => HttpResponse.json({ unread: 0 })),

  http.get(`${API_BASE_URL}/notifications`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.post(`${API_BASE_URL}/notifications/:id/read`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      type: 'PROPOSAL',
      title: 'Notification',
      message: 'Marked as read.',
      entityType: null,
      entityId: null,
      read: true,
      createdAt: new Date().toISOString(),
    }),
  ),

  http.get(`${API_BASE_URL}/administration/my-districts`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.get(`${API_BASE_URL}/administration/states`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.get(`${API_BASE_URL}/administration/departments`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.get(`${API_BASE_URL}/administration/talukas`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.get(`${API_BASE_URL}/administration/villages`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.get(`${API_BASE_URL}/administration/ministries`, () =>
    HttpResponse.json(emptyPage(20)),
  ),

  http.get(`${API_BASE_URL}/administration/divisions`, () =>
    HttpResponse.json(emptyPage(100)),
  ),

  http.get(`${API_BASE_URL}/administration/districts`, () =>
    HttpResponse.json(emptyPage(100)),
  ),

  http.get(`${API_BASE_URL}/administration/users`, () =>
    HttpResponse.json(emptyPage(20)),
  ),

  http.get(`${API_BASE_URL}/administration/users/:id/scopes`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/administration/roles`, () => HttpResponse.json([])),

  http.get(`${API_BASE_URL}/administration/audit-events`, () =>
    HttpResponse.json(emptyPage(20)),
  ),

  http.get(`${API_BASE_URL}/administration/login-history`, () =>
    HttpResponse.json(emptyPage(20)),
  ),

  http.get(`${API_BASE_URL}/projects/proposals`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.get(`${API_BASE_URL}/projects`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
    }),
  ),
]
