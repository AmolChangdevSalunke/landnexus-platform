import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ConflictWorkspacePage } from './ConflictWorkspacePage'
import { API_BASE_URL } from '../../api/client'
import type {
  ConflictReport,
  FeatureCollection,
  MapProps,
  ProjectResponse,
} from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, DISTRICT } from '../landRecords/testFixtures'

const PROJECT: ProjectResponse = {
  id: '99999999-9999-9999-9999-999999999999',
  code: 'PRJ-TEST-1',
  proposalId: '88888888-8888-8888-8888-888888888888',
  title: 'Test road widening',
  projectType: 'STATE_HIGHWAY',
  status: 'ACTIVE',
  stateId: '11111111-1111-1111-1111-111111111111',
  districtId: DISTRICT.id,
  talukaId: null,
  departmentId: '77777777-7777-7777-7777-777777777777',
  lengthKm: 1.2,
  estimatedLandAreaHa: 3.6,
  villageIds: [],
  ownerUserId: '11111111-1111-1111-1111-111111111111',
  approvedByUserId: '11111111-1111-1111-1111-111111111111',
  approvedAt: '2026-02-01T10:00:00Z',
  createdAt: '2026-02-01T10:00:00Z',
}

const MAP: FeatureCollection<MapProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [73.85, 19.87],
          [73.86, 19.87],
        ],
      },
      properties: { kind: 'ALIGNMENT', lengthKm: 1.2, corridorWidthM: 30 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [73.85, 19.87],
            [73.855, 19.87],
            [73.855, 19.875],
            [73.85, 19.875],
            [73.85, 19.87],
          ],
        ],
      },
      properties: {
        kind: 'PARCEL',
        parcelId: 'parcel-one',
        gatNumber: '12',
        surveyNumber: null,
        classification: 'FOREST',
        landUse: 'CULTIVATION',
        areaHa: 0.5,
        inCase: true,
      },
    },
  ],
}

const REPORT: ConflictReport = {
  projectId: PROJECT.id,
  projectCode: PROJECT.code,
  alignmentVersion: 1,
  corridorWidthM: 30,
  corridorAreaHa: 3.6,
  parcelsInProjectVillages: 2,
  parcelsWithBoundary: 2,
  affectedParcelCount: 2,
  totalAffectedHa: 0.8,
  warnings: 1,
  infos: 0,
  affectedParcels: [
    {
      parcelId: 'parcel-one',
      gatNumber: '12',
      surveyNumber: null,
      classification: 'FOREST',
      landUse: 'CULTIVATION',
      recordedAreaHa: 0.5,
      boundaryAreaHa: 0.5,
      affectedHa: 0.5,
      caseNumber: 'ACQ-1',
      areaToAcquireHa: 0.5,
      flags: ['FOREST_LAND'],
    },
  ],
  findings: [
    {
      code: 'FOREST_LAND',
      severity: 'WARNING',
      parcelId: 'parcel-one',
      message: 'A forest parcel crosses the corridor.',
    },
  ],
  limitations: ['Findings are indicators, not legal decisions.'],
}

function page<T>(content: T[], size = 20) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

/** Mirrors the reference endpoints the page reads through master data. */
function mockReferences() {
  server.use(
    http.get(`${API_BASE_URL}/administration/my-districts`, () =>
      HttpResponse.json(page([DISTRICT], 100)),
    ),
    http.get(`${API_BASE_URL}/administration/states`, () =>
      HttpResponse.json(page([], 100)),
    ),
  )
}

function mockProjectRecords() {
  server.use(
    http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(page([PROJECT]))),
    http.get(`${API_BASE_URL}/projects/:id`, () => HttpResponse.json(PROJECT)),
    http.get(`${API_BASE_URL}/gis/projects/:id/map`, () => HttpResponse.json(MAP)),
    http.get(`${API_BASE_URL}/gis/projects/:id/conflicts`, () =>
      HttpResponse.json(REPORT),
    ),
  )
}

describe('ConflictWorkspacePage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('lists projects and opens the full conflict report for one of them', async () => {
    const user = userEvent.setup()

    mockReferences()
    mockProjectRecords()

    renderWithProviders(<ConflictWorkspacePage />, {
      auth: authWith(['GIS_READ', 'PROPOSAL_READ_OWN']),
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Conflict workspace' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(PROJECT.title)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review conflicts' }))

    expect(
      await screen.findByRole('heading', { name: 'Findings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('A forest parcel crosses the corridor.')).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: `Affected parcels for project ${PROJECT.code}` }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open project details' })).toHaveAttribute(
      'href',
      `/projects/${PROJECT.id}`,
    )

    // The finder disappears while the report is open.
    expect(screen.queryByRole('button', { name: 'Review conflicts' })).not.toBeInTheDocument()
  })

  it('goes back to the finder from an open report', async () => {
    const user = userEvent.setup()

    mockReferences()
    mockProjectRecords()

    renderWithProviders(<ConflictWorkspacePage />, {
      auth: authWith(['GIS_READ', 'PROPOSAL_READ_OWN']),
      initialEntries: ['/?project=' + PROJECT.id],
    })

    expect(await screen.findByRole('heading', { name: 'Findings' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to project finder' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Review conflicts' })).toBeInTheDocument()
    })
  })

  it('shows an honest message when the project list is not permitted', async () => {
    mockReferences()

    renderWithProviders(<ConflictWorkspacePage />, {
      auth: authWith(['GIS_READ']),
    })

    expect(await screen.findByText('Project finder unavailable')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Review conflicts' }),
    ).not.toBeInTheDocument()
  })

  it('shows the error state when a deep-linked project cannot be loaded', async () => {
    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects/:id`, ({ request }) =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 404,
            error: 'Not Found',
            message: 'The requested project was not found.',
            path: new URL(request.url).pathname,
            fieldErrors: [],
          },
          { status: 404 },
        ),
      ),
    )

    renderWithProviders(<ConflictWorkspacePage />, {
      auth: authWith(['GIS_READ', 'PROPOSAL_READ_OWN']),
      initialEntries: ['/?project=' + PROJECT.id],
    })

    expect(await screen.findByText('Could not open this project')).toBeInTheDocument()
    expect(
      screen.getByText('The requested project was not found.'),
    ).toBeInTheDocument()
  })
})
