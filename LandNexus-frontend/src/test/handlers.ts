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

  http.get(`${API_BASE_URL}/land-records/parcels`, () => HttpResponse.json(emptyPage(20))),

  /* Minimal parcel-by-id default; feature tests override it with their fixtures. */
  http.get(`${API_BASE_URL}/land-records/parcels/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      stateId: '11111111-1111-1111-1111-111111111111',
      districtId: '22222222-2222-2222-2222-222222222222',
      talukaId: '33333333-3333-3333-3333-333333333333',
      villageId: '44444444-4444-4444-4444-444444444444',
      gatNumber: '123',
      surveyNumber: '45/2',
      subdivisionNumber: null,
      areaHa: 1.25,
      classification: 'AGRICULTURAL_IRRIGATED',
      landUse: 'CULTIVATION',
      status: 'ACTIVE',
      createdAt: '2026-02-01T10:00:00Z',
      updatedAt: '2026-02-01T10:00:00Z',
    }),
  ),

  /* Minimal document-by-id default; feature tests override it with their fixtures. */
  http.get(`${API_BASE_URL}/land-records/documents/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      parcelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      category: 'SEVEN_TWELVE_EXTRACT',
      title: '7/12 extract 2025',
      currentVersionNo: 1,
      verificationStatus: 'PENDING',
      verifiedVersionNo: null,
      verifiedByUserId: null,
      verifiedAt: null,
      verificationRemarks: null,
      createdAt: '2026-02-02T09:00:00Z',
      updatedAt: '2026-02-02T09:00:00Z',
      versions: [],
    }),
  ),

  http.get(`${API_BASE_URL}/land-records/parcels/:id/ownerships`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/land-records/parcels/:id/mutations`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/land-records/parcels/:id/revenue-records`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/land-records/parcels/:id/documents`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/land-records/landowners`, () => HttpResponse.json(emptyPage(20))),

  /* Acquisition defaults: no cases yet. Tests override these per case. */
  http.get(`${API_BASE_URL}/acquisition/cases`, () => HttpResponse.json(emptyPage(20))),

  http.get(`${API_BASE_URL}/acquisition/my-assignments`, () => HttpResponse.json([])),

  http.get(`${API_BASE_URL}/acquisition/cases/:id/parcels`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/acquisition/cases/:id/surveys`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/acquisition/cases/:id/history`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/acquisition/cases/:id/verification-report`, ({ request }) =>
    HttpResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 404,
        error: 'Not Found',
        message: 'No verification report exists for this case yet.',
        path: new URL(request.url).pathname,
        fieldErrors: [],
      },
      { status: 404 },
    ),
  ),

  http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () => HttpResponse.json([])),

  http.get(`${API_BASE_URL}/acquisition/cases/:id/objections`, () =>
    HttpResponse.json([]),
  ),

  /* The award endpoint returns 404 until an award is declared. */
  http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, ({ request }) =>
    HttpResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 404,
        error: 'Not Found',
        message: 'No award declared for this case',
        path: new URL(request.url).pathname,
        fieldErrors: [],
      },
      { status: 404 },
    ),
  ),

  http.get(`${API_BASE_URL}/acquisition/cases/:id/possessions`, () =>
    HttpResponse.json([]),
  ),

  /* Minimal case-by-id default; feature tests override it with their fixtures. */
  http.get(`${API_BASE_URL}/acquisition/cases/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      caseNumber: 'ACQ-2026-000000',
      projectId: '99999999-9999-4999-8999-999999999999',
      stateId: '11111111-1111-4111-8111-111111111111',
      districtId: '22222222-2222-4222-8222-222222222222',
      framework: 'LARR_2013',
      frameworkNote: null,
      description: null,
      status: 'INITIATED',
      villageIds: [],
      createdAt: '2026-02-01T10:00:00Z',
      updatedAt: '2026-02-01T10:00:00Z',
      availableActions: [],
    }),
  ),

  /* Compensation by-id defaults: minimal records, tests override with fixtures. */
  http.get(`${API_BASE_URL}/compensation/valuations/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      caseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      caseParcelId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      parcelId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      versionNo: 1,
      awardedAreaHa: 1,
      classification: 'AGRICULTURAL_IRRIGATED',
      ratePerHa: 1000000,
      ruleSetName: 'Default rule set',
      ruleSetVersion: 1,
      referenceDate: '2026-01-01',
      assetTotal: 0,
      totalAmount: 1000000,
      status: 'DRAFT',
      preparedByUsername: 'valuation.officer',
      decidedByUserId: null,
      decidedAt: null,
      decisionRemarks: null,
      createdAt: '2026-02-01T10:00:00Z',
      lines: [],
      availableActions: [],
    }),
  ),

  http.get(`${API_BASE_URL}/compensation/rr-cases/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      caseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      landownerId: 'ffffffff-1111-4fff-8fff-ffffffffffff',
      displaced: false,
      livelihoodLost: false,
      status: 'IDENTIFIED',
      notes: null,
      createdByUserId: '11111111-1111-4111-8111-111111111111',
      approvedByUserId: null,
      decidedAt: null,
      entitlements: [],
      availableActions: [],
    }),
  ),

  http.get(`${API_BASE_URL}/compensation/rule-sets/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      name: 'Default rule set',
      version: 1,
      framework: 'LARR_2013',
      stateId: null,
      districtId: null,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      description: null,
      status: 'DRAFT',
      createdByUserId: '11111111-1111-4111-8111-111111111111',
      approvedByUserId: null,
      approvedAt: null,
      retireReason: null,
      components: [],
    }),
  ),

  /* GIS defaults: no geometry recorded yet. Tests override these per case. */
  http.get(`${API_BASE_URL}/gis/parcels/:id/boundary`, ({ request }) =>
    HttpResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 404,
        error: 'Not Found',
        message: 'No boundary has been recorded for this parcel.',
        path: new URL(request.url).pathname,
        fieldErrors: [],
      },
      { status: 404 },
    ),
  ),

  http.get(`${API_BASE_URL}/gis/parcels/:id/boundary/history`, () => HttpResponse.json([])),

  http.get(`${API_BASE_URL}/gis/villages/:id/parcels`, () =>
    HttpResponse.json({ type: 'FeatureCollection', features: [] }),
  ),

  http.get(`${API_BASE_URL}/gis/projects/:id/alignment`, ({ request }) =>
    HttpResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 404,
        error: 'Not Found',
        message: 'No alignment has been recorded for this project.',
        path: new URL(request.url).pathname,
        fieldErrors: [],
      },
      { status: 404 },
    ),
  ),

  http.get(`${API_BASE_URL}/gis/projects/:id/corridor`, ({ request }) =>
    HttpResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 404,
        error: 'Not Found',
        message: 'No corridor exists until an alignment is recorded.',
        path: new URL(request.url).pathname,
        fieldErrors: [],
      },
      { status: 404 },
    ),
  ),

  http.get(`${API_BASE_URL}/gis/projects/:id/alignment/history`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${API_BASE_URL}/gis/projects/:id/map`, () =>
    HttpResponse.json({ type: 'FeatureCollection', features: [] }),
  ),

  http.get(`${API_BASE_URL}/gis/projects/:id/conflicts`, ({ request }) =>
    HttpResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 404,
        error: 'Not Found',
        message: 'This project has no alignment yet.',
        path: new URL(request.url).pathname,
        fieldErrors: [],
      },
      { status: 404 },
    ),
  ),
]
