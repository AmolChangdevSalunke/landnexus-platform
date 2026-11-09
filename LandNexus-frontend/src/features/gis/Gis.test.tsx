import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/client'
import type {
  ConflictReport,
  FeatureCollection,
  MapProps,
  ProjectResponse,
} from '../../api/types'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith } from '../landRecords/testFixtures'
import { GeometryEntryForm } from './GeometryEntryForm'
import { MapConflictsTab } from './MapConflictsTab'
import {
  MAX_GEOMETRY_CHARS,
  parseGeometryInput,
  readGeometryFile,
} from './geometryInput'
import { createProjection, niceScaleBar } from './projection'

const PROJECT: ProjectResponse = {
  id: '99999999-9999-9999-9999-999999999999',
  code: 'PRJ-TEST-1',
  proposalId: '88888888-8888-8888-8888-888888888888',
  title: 'Test road widening',
  projectType: 'STATE_HIGHWAY',
  status: 'ACTIVE',
  stateId: '11111111-1111-1111-1111-111111111111',
  districtId: '22222222-2222-2222-2222-222222222222',
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
        type: 'Polygon',
        coordinates: [
          [
            [73.85, 19.86],
            [73.86, 19.86],
            [73.86, 19.88],
            [73.85, 19.88],
            [73.85, 19.86],
          ],
        ],
      },
      properties: { kind: 'CORRIDOR', corridorWidthM: 30 },
    },
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
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [73.855, 19.87],
            [73.86, 19.87],
            [73.86, 19.875],
            [73.855, 19.875],
            [73.855, 19.87],
          ],
        ],
      },
      properties: {
        kind: 'PARCEL',
        parcelId: 'parcel-two',
        gatNumber: '13',
        surveyNumber: null,
        classification: 'AGRICULTURAL_IRRIGATED',
        landUse: 'CULTIVATION',
        areaHa: 0.4,
        inCase: false,
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
  infos: 1,
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
    {
      parcelId: 'parcel-two',
      gatNumber: '13',
      surveyNumber: null,
      classification: 'AGRICULTURAL_IRRIGATED',
      landUse: 'CULTIVATION',
      recordedAreaHa: 0.4,
      boundaryAreaHa: 0.4,
      affectedHa: 0.3,
      caseNumber: null,
      areaToAcquireHa: null,
      flags: ['NOT_IN_ACQUISITION_CASE'],
    },
  ],
  findings: [
    {
      code: 'PARCELS_WITHOUT_BOUNDARY',
      severity: 'INFO',
      parcelId: null,
      message: 'Some parcels in the project villages still have no boundary.',
    },
    {
      code: 'FOREST_LAND',
      severity: 'WARNING',
      parcelId: 'parcel-one',
      message: 'A forest parcel crosses the corridor.',
    },
  ],
  limitations: [
    'Boundaries exist only for parcels an officer has entered.',
    'Findings are indicators, not legal decisions.',
  ],
}

function gisHandlers(report: ConflictReport = REPORT) {
  return [
    http.get(`${API_BASE_URL}/gis/projects/:id/map`, () => HttpResponse.json(MAP)),
    http.get(`${API_BASE_URL}/gis/projects/:id/conflicts`, () =>
      HttpResponse.json(report),
    ),
  ]
}

const POLYGON = {
  type: 'Polygon',
  coordinates: [
    [
      [73.85, 19.87],
      [73.86, 19.87],
      [73.86, 19.88],
      [73.85, 19.87],
    ],
  ],
}

describe('GIS projection', () => {
  it('draws a metre square near 19.87 N about as wide as it is tall', () => {
    const lat0 = 19.87
    const latSpan = 0.001
    const lonSpan = latSpan / Math.cos((lat0 * Math.PI) / 180)
    const positions = [
      [73.85, lat0],
      [73.85 + lonSpan, lat0],
      [73.85 + lonSpan, lat0 + latSpan],
      [73.85, lat0 + latSpan],
    ]

    const projection = createProjection(positions, { width: 500, height: 500, padding: 20 })
    const southWest = projection.project([73.85, lat0])
    const southEast = projection.project([73.85 + lonSpan, lat0])
    const northWest = projection.project([73.85, lat0 + latSpan])

    const widthPixels = Math.abs(southEast.x - southWest.x)
    const heightPixels = Math.abs(northWest.y - southWest.y)
    const widthMetres = widthPixels * projection.metresPerPixel
    const heightMetres = heightPixels * projection.metresPerPixel

    expect(widthMetres / heightMetres).toBeCloseTo(1, 2)
  })

  it('builds a round scale bar', () => {
    expect(niceScaleBar(10, 120)).toEqual({ metres: 1000, pixels: 100, label: '1 km' })
    expect(niceScaleBar(1, 120)).toEqual({ metres: 100, pixels: 100, label: '100 m' })
    expect(niceScaleBar(0, 120).label).toBe('—')
  })
})

describe('GeoJSON paste and file validation', () => {
  it('accepts a bare geometry', () => {
    const result = parseGeometryInput(JSON.stringify(POLYGON), 'polygon')

    expect(result.errors).toEqual([])
    expect(result.geometry?.type).toBe('Polygon')
    expect(result.unwrapped).toBeNull()
  })

  it('unwraps a Feature and says so', () => {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [73.85, 19.87],
          [73.86, 19.88],
        ],
      },
    }

    const result = parseGeometryInput(JSON.stringify(feature), 'line')

    expect(result.geometry?.type).toBe('LineString')
    expect(result.unwrapped).toMatch(/unwrapped/i)
  })

  it('unwraps a FeatureCollection only when it holds one feature', () => {
    const single = parseGeometryInput(
      JSON.stringify({ type: 'FeatureCollection', features: [MAP.features[1]] }),
      'line',
    )
    expect(single.geometry?.type).toBe('LineString')
    expect(single.unwrapped).toMatch(/unwrapped/i)

    const many = parseGeometryInput(
      JSON.stringify({ type: 'FeatureCollection', features: MAP.features }),
      'line',
    )
    expect(many.geometry).toBeNull()
    expect(many.errors[0]).toMatch(/exactly one Feature/i)
  })

  it('warns when the first coordinate looks swapped', () => {
    const swapped = {
      type: 'LineString',
      coordinates: [
        [19.87, 73.85],
        [19.88, 73.86],
      ],
    }

    const result = parseGeometryInput(JSON.stringify(swapped), 'line')

    expect(result.geometry).not.toBeNull()
    expect(result.warnings.join(' ')).toMatch(/swapped/i)
  })

  it('rejects a geometry of the wrong kind and an oversized paste', () => {
    const wrongKind = parseGeometryInput(JSON.stringify(POLYGON), 'line')
    expect(wrongKind.geometry).toBeNull()
    expect(wrongKind.errors[0]).toMatch(/LineString or MultiLineString/i)

    const tooLong = parseGeometryInput('x'.repeat(MAX_GEOMETRY_CHARS + 1), 'polygon')
    expect(tooLong.geometry).toBeNull()
    expect(tooLong.errors[0]).toMatch(/too long/i)
  })

  it('reads a chosen file in the browser only', async () => {
    const raw = JSON.stringify(POLYGON)
    const file = new File([raw], 'parcel.geojson', { type: 'application/geo+json' })

    await expect(readGeometryFile(file)).resolves.toBe(raw)
  })

  it('fills the entry form from a chosen file and draws a preview', async () => {
    const user = userEvent.setup()
    const raw = JSON.stringify(POLYGON)

    renderWithProviders(
      <GeometryEntryForm
        kind="polygon"
        previewProperties={{
          kind: 'PARCEL',
          parcelId: 'parcel-one',
          gatNumber: '12',
          surveyNumber: null,
          classification: 'FOREST',
          landUse: 'CULTIVATION',
          areaHa: 0.5,
          inCase: false,
        }}
        submitLabel="Save boundary"
        onSave={async () => undefined}
        isSaving={false}
        serverError={null}
        previewLabel="Boundary preview"
      />,
    )

    const file = new File([raw], 'parcel.geojson', { type: 'application/geo+json' })
    await user.upload(screen.getByLabelText(/Read a .geojson or .json file/i), file)

    expect(await screen.findByLabelText(/GeoJSON geometry/i)).toHaveValue(raw)
    expect(screen.getByRole('img', { name: 'Boundary preview' })).toBeInTheDocument()
    expect(screen.getByText(/Selected file: parcel.geojson/)).toBeInTheDocument()
  })
})

describe('map and conflict report', () => {
  it('puts warnings before information and always shows the limitations', async () => {
    server.use(...gisHandlers())

    renderWithProviders(<MapConflictsTab project={PROJECT} />, {
      auth: authWith(['GIS_READ']),
    })

    const warnings = await screen.findByRole('region', { name: 'Warnings' })
    const infos = screen.getByRole('region', { name: 'Information' })

    expect(
      warnings.compareDocumentPosition(infos) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('A forest parcel crosses the corridor.')).toBeInTheDocument()

    expect(screen.getByText('Limitations of this report')).toBeInTheDocument()
    REPORT.limitations.forEach((limitation) => {
      expect(screen.getByText(limitation)).toBeInTheDocument()
    })
  })

  it('keeps the limitations box when the server sends none', async () => {
    server.use(...gisHandlers({ ...REPORT, limitations: [] }))

    renderWithProviders(<MapConflictsTab project={PROJECT} />, {
      auth: authWith(['GIS_READ']),
    })

    expect(await screen.findByText('Limitations of this report')).toBeInTheDocument()
    expect(screen.getByText(/server did not return any limitations/i)).toBeInTheDocument()
  })

  it('selects a parcel from the keyboard and marks it pressed', async () => {
    server.use(...gisHandlers())
    const user = userEvent.setup()

    renderWithProviders(<MapConflictsTab project={PROJECT} />, {
      auth: authWith(['GIS_READ']),
    })

    const forest = await screen.findByRole('button', { name: /Gat 12/ })
    forest.focus()
    await user.keyboard('{Enter}')

    expect(forest).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Gat 13/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows the honest empty state when no alignment exists yet', async () => {
    renderWithProviders(<MapConflictsTab project={PROJECT} />, {
      auth: authWith(['GIS_READ']),
    })

    expect(await screen.findByText('No alignment recorded yet')).toBeInTheDocument()
  })
})
