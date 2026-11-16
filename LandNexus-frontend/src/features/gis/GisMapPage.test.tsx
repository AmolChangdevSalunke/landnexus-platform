import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { GisMapPage } from './GisMapPage'
import { API_BASE_URL } from '../../api/client'
import type { DistrictResponse, ProjectResponse, StateResponse } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { TEST_USER } from '../../test/handlers'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'

const STATE: StateResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'MH',
  name: 'Maharashtra',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const DISTRICT: DistrictResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  code: 'PUNE',
  name: 'Pune',
  status: 'ACTIVE',
  stateId: STATE.id,
  stateName: STATE.name,
  divisionId: null,
  divisionName: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const PROJECT: ProjectResponse = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  code: 'PRJ-2026-000001',
  proposalId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  title: 'District hospital upgrade',
  projectType: 'HOSPITAL',
  status: 'ACTIVE',
  stateId: STATE.id,
  districtId: DISTRICT.id,
  talukaId: null,
  departmentId: '33333333-3333-3333-3333-333333333333',
  lengthKm: null,
  estimatedLandAreaHa: 2.5,
  villageIds: ['44444444-4444-4444-4444-444444444444'],
  ownerUserId: '55555555-5555-5555-5555-555555555555',
  approvedByUserId: '66666666-6666-6666-6666-666666666666',
  approvedAt: '2026-02-01T10:00:00Z',
  createdAt: '2026-02-01T10:00:00Z',
}

const DISTRICT_USER = {
  ...TEST_USER,
  roles: ['DISTRICT_ADMIN'],
  permissions: ['PROPOSAL_READ_OWN', 'MASTER_DATA_READ'],
}

const NATIONAL_USER = {
  ...TEST_USER,
  roles: ['SUPER_ADMIN'],
  permissions: ['PROPOSAL_READ_OWN', 'MASTER_DATA_READ'],
}

const MAP_ONLY_USER = {
  ...TEST_USER,
  roles: ['DISTRICT_ADMIN'],
  permissions: ['MASTER_DATA_READ'],
}

const GIS_USER = {
  ...TEST_USER,
  roles: ['DISTRICT_ADMIN'],
  permissions: ['MASTER_DATA_READ', 'GIS_READ', 'PROPOSAL_READ_OWN'],
}

const GIS_WRITER = {
  ...TEST_USER,
  roles: ['DISTRICT_ADMIN'],
  permissions: [
    'MASTER_DATA_READ',
    'GIS_READ',
    'GIS_WRITE',
    'LAND_RECORD_READ',
    'PROPOSAL_READ_OWN',
  ],
}

function auth(user: typeof TEST_USER) {
  return {
    user,
    accessToken: 'test-access-token',
    status: 'authenticated' as const,
    error: null,
  }
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

/** Mirrors the two reference endpoints the page reads through master data. */
function mockReferences() {
  server.use(
    http.get(`${API_BASE_URL}/administration/my-districts`, () =>
      HttpResponse.json(page([DISTRICT], 100)),
    ),
    http.get(`${API_BASE_URL}/administration/states`, () =>
      HttpResponse.json(page([STATE], 100)),
    ),
  )
}

describe('GisMapPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('plots real projects and reports the backend total and scope', async () => {
    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(page([PROJECT]))),
    )

    renderWithProviders(<GisMapPage />, { auth: auth(NATIONAL_USER) })

    expect(screen.getByRole('heading', { level: 1, name: 'GIS map' })).toBeInTheDocument()

    const link = await screen.findByRole('link', { name: PROJECT.title })
    expect(link).toHaveAttribute('href', `/projects/${PROJECT.id}`)

    const table = screen.getByRole('table', { name: 'Projects plotted on the GIS map' })
    expect(within(table).getByText(PROJECT.code)).toBeInTheDocument()
    expect(within(table).getByText('Active')).toBeInTheDocument()
    expect(within(table).getByText('Pune')).toBeInTheDocument()

    // The count comes from the backend page, never from an invented summary.
    const visibleLabel = screen.getByText('Visible projects')
    expect(
      within(visibleLabel.parentElement as HTMLElement).getByText('1'),
    ).toBeInTheDocument()
    expect(screen.getByText('Nation-wide')).toBeInTheDocument()

    // The bundled India map is a real boundary layer, not generated geometry.
    expect(
      await screen.findByRole(
        'img',
        { name: /Map of India showing states with ongoing projects/ },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })

  it('renders the interactive OpenStreetMap and backend GIS feature layers', async () => {
    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(page([PROJECT]))),
      http.get(`${API_BASE_URL}/gis/imagery/status`, () =>
        HttpResponse.json({
          enabled: false,
          provider: 'ISRO Bhuvan',
          kind: 'WMS',
          overlayAvailable: false,
          attribution: null,
          message: 'Not configured',
        }),
      ),
      http.get(`${API_BASE_URL}/gis/projects/${PROJECT.id}/map`, () =>
        HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[[73.8, 18.5], [73.81, 18.5], [73.81, 18.51], [73.8, 18.5]]],
              },
              properties: {
                kind: 'PARCEL',
                parcelId: 'parcel-1',
                gatNumber: 'DEMO-101',
                surveyNumber: null,
                classification: 'AGRICULTURAL',
                landUse: 'AGRICULTURE',
                areaHa: 1.2,
                inCase: true,
              },
            },
          ],
        }),
      ),
    )

    renderWithProviders(<GisMapPage />, { auth: auth(GIS_USER) })

    expect(await screen.findByRole('application', {
      name: 'OpenStreetMap with NLAMS spatial layers',
    })).toBeInTheDocument()
    expect(await screen.findByText('GIS DATA LAYERS ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('BHUVAN UNAVAILABLE - OSM FALLBACK ACTIVE')).toBeInTheDocument()
  })

  it('uploads a polygon to the scoped PostGIS parcel boundary API', async () => {
    const user = userEvent.setup()
    const talukaId = '77777777-7777-7777-7777-777777777777'
    const villageId = '88888888-8888-8888-8888-888888888888'
    const parcelId = '99999999-9999-9999-9999-999999999999'
    let uploadedGeometry: unknown = null

    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(page([PROJECT]))),
      http.get(`${API_BASE_URL}/administration/talukas`, () =>
        HttpResponse.json(page([{
          id: talukaId,
          code: 'DEMO-TALUKA',
          name: 'Demo Taluka',
          status: 'ACTIVE',
          districtId: DISTRICT.id,
          districtName: DISTRICT.name,
        }])),
      ),
      http.get(`${API_BASE_URL}/administration/villages`, () =>
        HttpResponse.json(page([{
          id: villageId,
          code: 'DEMO-VILLAGE',
          name: 'Demo Village',
          status: 'ACTIVE',
          talukaId,
          talukaName: 'Demo Taluka',
        }])),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels`, () =>
        HttpResponse.json(page([{
          id: parcelId,
          stateId: STATE.id,
          districtId: DISTRICT.id,
          talukaId,
          villageId,
          gatNumber: 'DEMO-GAT-1',
          surveyNumber: null,
          subdivisionNumber: null,
          areaHa: 1.5,
          classification: 'AGRICULTURAL',
          landUse: 'AGRICULTURE',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }])),
      ),
      http.get(`${API_BASE_URL}/gis/imagery/status`, () =>
        HttpResponse.json({
          enabled: false,
          provider: 'ISRO Bhuvan',
          kind: 'WMS',
          overlayAvailable: false,
          attribution: '',
          message: 'Not configured',
        }),
      ),
      http.get(`${API_BASE_URL}/gis/projects/${PROJECT.id}/map`, () =>
        HttpResponse.json({ type: 'FeatureCollection', features: [] }),
      ),
      http.get(`${API_BASE_URL}/gis/villages/${villageId}/parcels`, () =>
        HttpResponse.json({ type: 'FeatureCollection', features: [] }),
      ),
      http.put(`${API_BASE_URL}/gis/parcels/${parcelId}/boundary`, async ({ request }) => {
        uploadedGeometry = await request.json()
        return HttpResponse.json({
          parcelId,
          versionNo: 1,
          areaHa: 1.2,
          recordedAreaHa: 1.5,
          variancePercent: -20,
          vertices: 5,
        })
      }),
    )

    renderWithProviders(<GisMapPage />, { auth: auth(GIS_WRITER) })
    await user.selectOptions(await screen.findByLabelText('Land district (parcel lookup)'), DISTRICT.id)
    await user.selectOptions(await screen.findByLabelText('Taluka'), talukaId)
    await user.selectOptions(await screen.findByLabelText('Village / parcel layer'), villageId)
    await user.upload(
      screen.getByLabelText('Upload GeoJSON'),
      new File([JSON.stringify({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[73.8, 18.5], [73.81, 18.5], [73.81, 18.51], [73.8, 18.5]]],
        },
        properties: {},
      })], 'parcel.geojson', { type: 'application/geo+json' }),
    )
    await user.selectOptions(await screen.findByLabelText('Parcel boundary target'), parcelId)
    await user.click(await screen.findByRole('button', { name: 'Save selected geometry to PostGIS' }))

    await waitFor(() => {
      expect(uploadedGeometry).toMatchObject({ type: 'Polygon' })
    })
    expect(await screen.findByText(/Geometry saved to PostGIS/)).toBeInTheDocument()
  })

  it('asks the backend for one district when the filter changes', async () => {
    const user = userEvent.setup()
    const urls: string[] = []

    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json(page([PROJECT]))
      }),
    )

    renderWithProviders(<GisMapPage />, { auth: auth(DISTRICT_USER) })

    await screen.findByRole('link', { name: PROJECT.title })
    await user.selectOptions(screen.getByLabelText('District'), DISTRICT.id)

    await waitFor(() => {
      const filtered = urls.find((value) => {
        const url = new URL(value)
        return url.searchParams.get('districtId') === DISTRICT.id
      })
      expect(filtered).toBeDefined()
      expect(new URL(String(filtered)).searchParams.get('page')).toBe('0')
    })
  })

  it('filters the project table when a district is selected on the map', async () => {
    const user = userEvent.setup()
    const urls: string[] = []

    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json(page([PROJECT]))
      }),
    )

    renderWithProviders(<GisMapPage />, { auth: auth(DISTRICT_USER) })

    await screen.findByRole('link', { name: PROJECT.title })

    // The bundled boundary is "Pune District"; the backend master is "Pune".
    const districtArea = await screen.findByRole(
      'button',
      { name: /Filter projects in Pune District/ },
      { timeout: 5000 },
    )

    expect(
      screen.getByRole('group', {
        name: /Map of Pune district in Maharashtra showing ongoing projects/,
      }),
    ).toBeInTheDocument()

    await user.click(districtArea)

    await waitFor(() => {
      expect(
        urls.some(
          (value) => new URL(value).searchParams.get('districtId') === DISTRICT.id,
        ),
      ).toBe(true)
    })
  })

  it('shows an honest empty state when the backend returns no projects', async () => {
    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects`, () =>
        HttpResponse.json(page<ProjectResponse>([])),
      ),
    )

    renderWithProviders(<GisMapPage />, { auth: auth(DISTRICT_USER) })

    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    expect(
      screen.getByText('A project appears here after a recommended proposal is approved.'),
    ).toBeInTheDocument()
  })

  it('shows a friendly error when the project list cannot be loaded', async () => {
    mockReferences()
    server.use(
      http.get(`${API_BASE_URL}/projects`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 403,
            error: 'Forbidden',
            message: 'You are not allowed to read projects.',
            path: '/api/v1/projects',
            fieldErrors: [],
          },
          { status: 403 },
        ),
      ),
    )

    renderWithProviders(<GisMapPage />, { auth: auth(DISTRICT_USER) })

    expect(await screen.findByText('You do not have access')).toBeInTheDocument()
    expect(
      screen.getByText('You do not have permission to do this.'),
    ).toBeInTheDocument()
  })

  it('keeps the map usable but hides the table when proposal read is missing', async () => {
    mockReferences()

    renderWithProviders(<GisMapPage />, { auth: auth(MAP_ONLY_USER) })

    expect(await screen.findByText('Project list unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(/Listing projects needs proposal read access\./),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('table', { name: 'Projects plotted on the GIS map' }),
    ).not.toBeInTheDocument()

    // Scope is still shown because the route only requires master data read.
    expect(screen.getByText('1 district')).toBeInTheDocument()
  })
})
