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

  http.get(`${API_BASE_URL}/projects/proposals/my-tasks`, () =>
    HttpResponse.json({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    }),
  ),

  http.get(`${API_BASE_URL}/projects/proposals/:id/assignments`, () => HttpResponse.json([])),

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

  /* Imagery defaults: disabled unless a test overrides these. */
  http.get(`${API_BASE_URL}/gis/imagery/status`, () =>
    HttpResponse.json({
      enabled: false,
      provider: 'ISRO Bhuvan',
      kind: 'WMS',
      overlayAvailable: false,
      attribution: '',
      message:
        'Satellite imagery is not enabled. Get access from the provider (for example ISRO Bhuvan), then follow docs/IMAGERY_SETUP.md.',
    }),
  ),

  http.get(`${API_BASE_URL}/gis/imagery/map`, () =>
    HttpResponse.json(
      { status: 503, message: 'Satellite imagery is not enabled on this server' },
      { status: 503 },
    ),
  ),

  http.post(`${API_BASE_URL}/gis/imagery/test`, () =>
    HttpResponse.json({
      ok: false,
      connectionState: 'UNAVAILABLE',
      httpStatus: null,
      contentType: null,
      bytes: 0,
      elapsedMs: 0,
      message: 'Satellite imagery is not enabled on this server',
    }),
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

  /* Monitoring defaults. Tests override these with restricted or failing cases. */
  http.get(`${API_BASE_URL}/monitoring/dashboard`, ({ request }) => {
    const url = new URL(request.url)
    const stateId = url.searchParams.get('stateId')
    const districtId = url.searchParams.get('districtId')
    return HttpResponse.json({
      ...DASHBOARD_FIXTURE,
      level: districtId ? 'DISTRICT' : stateId ? 'STATE' : 'NATIONAL',
      stateId: stateId ?? null,
      districtId: districtId ?? null,
    })
  }),

  http.get(`${API_BASE_URL}/monitoring/nlams`, ({ request }) => {
    const url = new URL(request.url)
    const stateId = url.searchParams.get('stateId')
    const districtId = url.searchParams.get('districtId')
    return HttpResponse.json({
      ...NLAMS_FIXTURE,
      stateId: stateId ?? null,
      districtId: districtId ?? null,
    })
  }),

  http.get(`${API_BASE_URL}/monitoring/reports`, () => HttpResponse.json(REPORT_CATALOGUE)),

  http.get(`${API_BASE_URL}/monitoring/reports/:code`, ({ params, request }) => {
    const url = new URL(request.url)
    const code = String(params.code)
    return HttpResponse.json({
      ...reportResult(code),
      page: Number(url.searchParams.get('page') ?? 0),
      size: Number(url.searchParams.get('size') ?? 50),
    })
  }),

  http.get(`${API_BASE_URL}/monitoring/reports/:code/export.csv`, ({ params }) =>
    new HttpResponse(`code,title\n${String(params.code)},Example\n`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${String(params.code).toLowerCase()}.csv"`,
      },
    }),
  ),

  http.get(`${API_BASE_URL}/monitoring/sla`, () => HttpResponse.json(SLA_FIXTURE)),

  http.get(`${API_BASE_URL}/monitoring/sla/escalations`, () =>
    HttpResponse.json({ rows: ESCALATION_FIXTURE, page: 0, size: 20, totalRows: 1 }),
  ),

  http.get(`${API_BASE_URL}/monitoring/forecast`, () => HttpResponse.json(FORECAST_FIXTURE)),
]

/* ------------------------------------------------------------------ */
/* Monitoring fixtures shared by the dashboard tests                   */
/* ------------------------------------------------------------------ */

export const DASHBOARD_FIXTURE = {
  generatedAt: '2026-02-10T09:00:00Z',
  level: 'NATIONAL' as const,
  stateId: null,
  districtId: null,
  proposals: {
    byStatus: {
      DRAFT: 2,
      SUBMITTED: 3,
      UNDER_SCRUTINY: 4,
      CLARIFICATION_REQUESTED: 1,
      RECOMMENDED: 2,
      APPROVED: 5,
      REJECTED: 1,
    },
    total: 18,
    inReview: 7,
    awaitingDecision: 2,
    approved: 5,
    rejected: 1,
  },
  projects: {
    byStatus: { ACTIVE: 4, CLOSED: 1 },
    total: 5,
    estimatedLandAreaHa: 42.5,
  },
  land: {
    activeParcels: 120,
    totalAreaHa: 88.25,
    parcelsWithBoundary: 90,
    boundaryCoveragePercent: 75,
    documentsPendingVerification: 6,
  },
  acquisition: {
    casesByStatus: {
      INITIATED: 2,
      SURVEY_IN_PROGRESS: 3,
      VERIFICATION_COMPLETE: 2,
      NOTIFICATION_ISSUED: 1,
      READY_FOR_AWARD: 1,
      AWARD_DECLARED: 1,
      POSSESSION_TAKEN: 1,
      CLOSED: 1,
      CANCELLED: 1,
    },
    totalCases: 13,
    openCases: 11,
    parcelsIdentified: 47,
    areaToAcquireHa: 30.75,
    surveysByStatus: { SUBMITTED: 2, VERIFIED: 5, REJECTED: 1 },
    objectionsByStatus: { OPEN: 1, ACCEPTED: 1, DISMISSED: 1 },
    awardsDeclared: 1,
    possessionsRecorded: 1,
  },
  finance: {
    estimates: [
      { status: 'DRAFT', count: 1, amount: 100000 },
      { status: 'SUBMITTED', count: 1, amount: 200000 },
      { status: 'APPROVED', count: 2, amount: 400000 },
      { status: 'REJECTED', count: 1, amount: 50000 },
    ],
    payments: [
      { status: 'INSTRUCTED', count: 1, amount: 50000 },
      { status: 'SENT', count: 1, amount: 60000 },
      { status: 'CONFIRMED', count: 2, amount: 300000 },
      { status: 'FAILED', count: 1, amount: 10000 },
    ],
    rrCasesByStatus: { IDENTIFIED: 2, ASSESSED: 1, APPROVED: 1, COMPLETED: 1 },
    pfmsSimulatedPayments: [{ status: 'CONFIRMED', count: 1, amount: 150000 }],
    dbtSimulatedPayments: [{ status: 'FAILED', count: 1, amount: 10000 }],
    paymentsByChannel: {
      PFMS_SIMULATED: [{ status: 'CONFIRMED', count: 1, amount: 150000 }],
      DBT_SIMULATED: [{ status: 'FAILED', count: 1, amount: 10000 }],
      OTHER_SIMULATED: [],
      UNCLASSIFIED: [],
    },
    paymentMode: 'SIMULATED' as const,
  },
  operations: {
    gisConflicts: 3,
    pendingTasks: 4,
    escalationsByLevel: { WARNING: 2, BREACH: 1 },
    officerWorkload: [],
  },
  trend: [
    { month: '2025-09', proposalsSubmitted: 2, casesOpened: 1 },
    { month: '2025-10', proposalsSubmitted: 3, casesOpened: 2 },
    { month: '2025-11', proposalsSubmitted: 1, casesOpened: 3 },
    { month: '2025-12', proposalsSubmitted: 4, casesOpened: 1 },
    { month: '2026-01', proposalsSubmitted: 5, casesOpened: 4 },
    { month: '2026-02', proposalsSubmitted: 3, casesOpened: 2 },
  ],
  districts: [
    {
      districtId: '22222222-2222-4222-8222-222222222222',
      district: 'Pune',
      state: 'Maharashtra',
      projects: 3,
      openCases: 6,
      parcels: 30,
      areaToAcquireHa: 20.5,
    },
    {
      districtId: '33333333-3333-4333-8333-333333333333',
      district: 'Nagpur',
      state: 'Maharashtra',
      projects: 2,
      openCases: 5,
      parcels: 17,
      areaToAcquireHa: 10.25,
    },
  ],
  notes: ['All figures are limited to your geographic scope.'],
}

export const NLAMS_FIXTURE = {
  generatedAt: '2026-02-10T09:00:00Z',
  stateId: null,
  districtId: null,
  paymentMode: 'SIMULATED' as const,
  totals: {
    projects: 2,
    projectsInAcquisition: 2,
    totalCases: 2,
    openCases: 1,
    parcelsIdentified: 12,
    identifiedHa: 24.5,
    parcelsNotified: 8,
    notifiedHa: 16.25,
    parcelsAwarded: 5,
    awardedHa: 10,
    parcelsPossessed: 3,
    possessionHa: 6,
    assessedTotal: 1250000,
    paidTotal: 750000,
    sentTotal: 250000,
    failedTotal: 0,
    affectedFamilies: 9,
    displacedFamilies: 2,
    rrEntitlements: 14,
    rrDelivered: 6,
  },
  projectsByStage: {
    'Parcels identified': 1,
    'Notification complete': 1,
  },
  projects: [
    {
      projectId: '44444444-4444-4444-8444-444444444444',
      projectCode: 'PRJ-2026-000001',
      title: 'Pune bypass widening',
      projectType: 'STATE_HIGHWAY',
      projectStatus: 'ACTIVE',
      districtId: '22222222-2222-4222-8222-222222222222',
      districtName: 'Pune',
      estimatedLandAreaHa: 18.5,
      alignmentLengthKm: 7.4,
      cases: 1,
      openCases: 1,
      casesAwaitingNotification: 0,
      casesNotified: 1,
      casesAwaitingAward: 1,
      casesPossessionComplete: 0,
      parcelsIdentified: 8,
      identifiedHa: 16.5,
      parcelsNotified: 8,
      notifiedHa: 16.25,
      awards: 0,
      parcelsAwarded: 0,
      awardedHa: 0,
      parcelsPossessed: 0,
      possessionHa: 0,
      possessionPhysical: 0,
      possessionDeemed: 0,
      notices: 8,
      objections: 2,
      objectionsOpen: 1,
      assessedTotal: 850000,
      awaitingApprovalTotal: 400000,
      paidTotal: 350000,
      sentTotal: 100000,
      failedTotal: 0,
      instructedTotal: 50000,
      affectedFamilies: 6,
      displacedFamilies: 1,
      livelihoodLostFamilies: 2,
      rrCases: 3,
      rrCompleted: 1,
      rrEntitlements: 8,
      rrDelivered: 3,
      progressPercent: 60,
      currentStage: 'Notification complete',
    },
    {
      projectId: '55555555-5555-4555-8555-555555555555',
      projectCode: 'PRJ-2026-000002',
      title: 'Nagpur water pipeline',
      projectType: 'IRRIGATION',
      projectStatus: 'ACTIVE',
      districtId: '33333333-3333-4333-8333-333333333333',
      districtName: 'Nagpur',
      estimatedLandAreaHa: 9.25,
      alignmentLengthKm: 3.2,
      cases: 1,
      openCases: 0,
      casesAwaitingNotification: 1,
      casesNotified: 0,
      casesAwaitingAward: 0,
      casesPossessionComplete: 0,
      parcelsIdentified: 4,
      identifiedHa: 8,
      parcelsNotified: 0,
      notifiedHa: 0,
      awards: 0,
      parcelsAwarded: 0,
      awardedHa: 0,
      parcelsPossessed: 0,
      possessionHa: 0,
      possessionPhysical: 0,
      possessionDeemed: 0,
      notices: 0,
      objections: 0,
      objectionsOpen: 0,
      assessedTotal: 400000,
      awaitingApprovalTotal: 200000,
      paidTotal: 0,
      sentTotal: 0,
      failedTotal: 0,
      instructedTotal: 0,
      affectedFamilies: 3,
      displacedFamilies: 1,
      livelihoodLostFamilies: 1,
      rrCases: 2,
      rrCompleted: 0,
      rrEntitlements: 6,
      rrDelivered: 3,
      progressPercent: 40,
      currentStage: 'Parcels identified',
    },
  ],
}

const REPORT_CATALOGUE = [
  {
    code: 'PROJECTS',
    title: 'Projects',
    description: 'Approved projects with district and area.',
    columns: [
      { key: 'code', label: 'Code', type: 'TEXT' },
      { key: 'title', label: 'Title', type: 'TEXT' },
      { key: 'status', label: 'Status', type: 'TEXT' },
      { key: 'area', label: 'Area (ha)', type: 'NUMBER' },
    ],
  },
  {
    code: 'ACQUISITION_CASES',
    title: 'Acquisition cases',
    description: 'Cases with their current status.',
    columns: [
      { key: 'caseNumber', label: 'Case number', type: 'TEXT' },
      { key: 'status', label: 'Status', type: 'TEXT' },
      { key: 'opened', label: 'Opened', type: 'DATE' },
    ],
  },
  {
    code: 'COMPENSATION',
    title: 'Compensation',
    description: 'Estimates with parcel and amount.',
    columns: [
      { key: 'caseNumber', label: 'Case number', type: 'TEXT' },
      { key: 'amount', label: 'Amount', type: 'MONEY' },
    ],
  },
]

function reportResult(code: string) {
  const info = REPORT_CATALOGUE.find((entry) => entry.code === code) ?? REPORT_CATALOGUE[0]
  const rows =
    code === 'COMPENSATION'
      ? [{ caseNumber: 'ACQ-2026-000001', amount: 400000 }]
      : code === 'ACQUISITION_CASES'
        ? [{ caseNumber: 'ACQ-2026-000001', status: 'INITIATED', opened: '2026-01-05' }]
        : [{ code: 'PRJ-2026-000001', title: 'Ring road', status: 'ACTIVE', area: 12.5 }]
  return {
    code: info.code,
    title: info.title,
    columns: info.columns,
    rows,
    page: 0,
    size: 50,
    totalRows: rows.length,
  }
}

const SLA_FIXTURE = {
  generatedAt: '2026-02-10T09:00:00Z',
  onTime: 5,
  warning: 2,
  breach: 1,
  byType: [
    {
      itemType: 'PROPOSAL_AWAITING_SCRUTINY',
      title: 'Proposal awaiting scrutiny',
      onTime: 3,
      warning: 1,
      breach: 0,
      warnAfterHours: 48,
      breachAfterHours: 120,
      responsibleRole: 'SCRUTINY_OFFICER',
    },
    {
      itemType: 'PAYMENT_AWAITING_RELEASE',
      title: 'Payment awaiting release',
      onTime: 2,
      warning: 1,
      breach: 1,
      warnAfterHours: 24,
      breachAfterHours: 72,
      responsibleRole: 'DISTRICT_COLLECTOR',
    },
  ],
  items: [
    {
      itemType: 'PAYMENT_AWAITING_RELEASE',
      title: 'Payment awaiting release',
      entityId: '44444444-4444-4444-8444-444444444444',
      reference: 'ACQ-2026-000001',
      districtId: '22222222-2222-4222-8222-222222222222',
      since: '2026-02-05T09:00:00Z',
      ageHours: 96,
      level: 'BREACH',
      responsibleRole: 'DISTRICT_COLLECTOR',
    },
    {
      itemType: 'PROPOSAL_AWAITING_SCRUTINY',
      title: 'Proposal awaiting scrutiny',
      entityId: '55555555-5555-4555-8555-555555555555',
      reference: 'PRP-2026-000009',
      districtId: '22222222-2222-4222-8222-222222222222',
      since: '2026-02-08T09:00:00Z',
      ageHours: 50,
      level: 'WARNING',
      responsibleRole: 'SCRUTINY_OFFICER',
    },
  ],
  itemsTruncated: false,
  notes: ['SLA limits are configured in the backend.'],
}

const ESCALATION_FIXTURE = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    itemType: 'PAYMENT_AWAITING_RELEASE',
    entityId: '44444444-4444-4444-8444-444444444444',
    reference: 'ACQ-2026-000001',
    level: 'BREACH',
    thresholdHours: 72,
    since: '2026-02-05T09:00:00Z',
    responsibleRole: 'DISTRICT_COLLECTOR',
    escalateRole: 'STATE_COLLECTOR',
    triggeredBy: 'SLA_SCAN',
    createdAt: '2026-02-10T08:00:00Z',
  },
]

const FORECAST_FIXTURE = {
  generatedAt: '2026-02-10T09:00:00Z',
  method: 'MEDIAN_AND_P90',
  methodNote:
    'A statistical forecast from this system’s own completed-item history. It is not machine learning.',
  stages: [
    {
      itemType: 'PAYMENT_AWAITING_RELEASE',
      title: 'Payment awaiting release',
      samples: 12,
      medianHours: 30,
      p90Hours: 60,
      warnAfterHours: 24,
      breachAfterHours: 72,
      open: 3,
      atRisk: 1,
    },
  ],
  items: [
    {
      itemType: 'PAYMENT_AWAITING_RELEASE',
      title: 'Payment awaiting release',
      entityId: '44444444-4444-4444-8444-444444444444',
      reference: 'ACQ-2026-000001',
      districtId: '22222222-2222-4222-8222-222222222222',
      since: '2026-02-05T09:00:00Z',
      ageHours: 96,
      risk: 'HIGH',
      breachProbability: 0.82,
      expectedRemainingHours: 12,
      samples: 12,
      comparable: 10,
      explanation: 'Older than the P90 of comparable completed items.',
      responsibleRole: 'DISTRICT_COLLECTOR',
    },
  ],
  itemsTruncated: false,
  notes: ['Forecast uses completed-item history only.'],
}
