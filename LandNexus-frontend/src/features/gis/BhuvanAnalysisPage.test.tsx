import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/client'
import type { BhuvanHistoryPage, BhuvanLulcAnalysis, BhuvanStatus } from '../../api/types'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith } from '../landRecords/testFixtures'
import { BhuvanAnalysisPage } from './BhuvanAnalysisPage'

const RUN_ID = '99999999-9999-4999-8999-999999999999'

const CONFIGURED: BhuvanStatus = {
  enabled: true,
  tokenConfigured: true,
  lulcAvailable: true,
  villageGeocodingAvailable: true,
  maharashtraVillageVerified: false,
  documentedVillageStates: ['AP', 'KA'],
  provider: 'ISRO Bhuvan',
  message:
    'Bhuvan is configured. LULC AOI analysis is available; village lookup is limited to the documented states.',
}

const ANALYSIS: BhuvanLulcAnalysis = {
  runId: RUN_ID,
  projectId: null,
  projectCode: null,
  stateCode: null,
  stateName: null,
  districtName: null,
  aoiSource: 'USER_WKT',
  aoiAreaHa: 123.4567,
  status: 'SUCCESS',
  message: 'Bhuvan LULC response received',
  fetchedAt: '2026-02-10T09:00:00Z',
  records: [
    { year: '2021-22', description: 'Cropland', areaSqKm: 10.5, raw: {} },
    { year: '2021-22', description: 'Forest', areaSqKm: 2.5, raw: {} },
  ],
  totals: [
    { description: 'Cropland', areaSqKm: 10.5, records: 1 },
    { description: 'Forest', areaSqKm: 2.5, records: 1 },
  ],
  years: ['2021-22'],
  raw: [{ year: '2021-22', description: 'Cropland', area_sq_km: '10.5' }],
}

const HISTORY: BhuvanHistoryPage = {
  content: [
    {
      runId: RUN_ID,
      projectId: null,
      projectCode: null,
      stateCode: 'MH',
      stateName: 'Maharashtra',
      districtName: 'Pune',
      aoiSource: 'USER_WKT',
      aoiAreaHa: 123.4567,
      status: 'SUCCESS',
      message: 'Bhuvan LULC response received',
      recordCount: 2,
      totalAreaSqKm: 13,
      requestedByUsername: 'analyst',
      createdAt: '2026-02-10T09:00:00Z',
      resultAvailable: true,
    },
  ],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
}

function useStatus(status: BhuvanStatus = CONFIGURED) {
  server.use(http.get(`${API_BASE_URL}/gis/bhuvan/status`, () => HttpResponse.json(status)))
}

describe('BhuvanAnalysisPage', () => {
  it('shows the backend status and refuses access without GIS_READ', async () => {
    useStatus()

    renderWithProviders(<BhuvanAnalysisPage />, { auth: authWith(['SETTINGS_MANAGE']) })

    expect(await screen.findByText('GIS read permission is required')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run LULC analysis' })).not.toBeInTheDocument()
  })

  it('shows configuration and coverage limits from the backend status', async () => {
    useStatus()

    renderWithProviders(<BhuvanAnalysisPage />, { auth: authWith(['GIS_READ']) })

    expect(await screen.findByText('Bhuvan configured')).toBeInTheDocument()
    expect(screen.getByText(/Village lookup documented states: AP, KA/)).toBeInTheDocument()
    expect(screen.getByText(/Maharashtra is not verified/)).toBeInTheDocument()
    expect(screen.getByText('Backend-only token')).toBeInTheDocument()
  })

  it('runs a WKT LULC analysis through the backend and shows the stored answer', async () => {
    const user = userEvent.setup()
    let received: unknown = null
    useStatus()
    server.use(
      http.post(`${API_BASE_URL}/gis/bhuvan/lulc/aoi`, async ({ request }) => {
        received = await request.json()
        return HttpResponse.json(ANALYSIS)
      }),
    )

    renderWithProviders(<BhuvanAnalysisPage />, { auth: authWith(['GIS_READ']) })

    await screen.findByText('Bhuvan configured')
    await user.type(
      screen.getByLabelText('Or enter a WKT Polygon'),
      'POLYGON((73.85 18.52,73.86 18.52,73.86 18.53,73.85 18.53,73.85 18.52))',
    )
    await user.click(screen.getByRole('button', { name: 'Run LULC analysis' }))

    expect(await screen.findByText('Analysis result')).toBeInTheDocument()
    expect(screen.getByText('Bhuvan LULC response received')).toBeInTheDocument()
    expect(screen.getAllByText('Cropland').length).toBeGreaterThan(0)
    expect(screen.getByText('123.46 ha')).toBeInTheDocument()
    expect(received).toEqual({
      projectId: null,
      wkt: 'POLYGON((73.85 18.52,73.86 18.52,73.86 18.53,73.85 18.53,73.85 18.52))',
    })
  })

  it('keeps a provider failure visible instead of pretending the analysis succeeded', async () => {
    const user = userEvent.setup()
    useStatus()
    server.use(
      http.post(`${API_BASE_URL}/gis/bhuvan/lulc/aoi`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 502,
            error: 'Bad Gateway',
            message: 'Bhuvan rejected the configured access token',
            path: '/api/v1/gis/bhuvan/lulc/aoi',
            fieldErrors: [],
          },
          { status: 502 },
        ),
      ),
    )

    renderWithProviders(<BhuvanAnalysisPage />, { auth: authWith(['GIS_READ']) })

    await screen.findByText('Bhuvan configured')
    await user.type(screen.getByLabelText('Or enter a WKT Polygon'), 'POLYGON((73 18,74 18,74 19,73 19,73 18))')
    await user.click(screen.getByRole('button', { name: 'Run LULC analysis' }))

    expect(await screen.findByText('Bhuvan analysis failed')).toBeInTheDocument()
    expect(screen.getByText('Bhuvan rejected the configured access token')).toBeInTheDocument()
    expect(screen.queryByText('Analysis result')).not.toBeInTheDocument()
  })

  it('lists stored analyses and opens one without re-calling Bhuvan', async () => {
    const user = userEvent.setup()
    useStatus()
    server.use(
      http.get(`${API_BASE_URL}/gis/bhuvan/history`, () => HttpResponse.json(HISTORY)),
      http.get(`${API_BASE_URL}/gis/bhuvan/history/${RUN_ID}`, () => HttpResponse.json(ANALYSIS)),
    )

    renderWithProviders(<BhuvanAnalysisPage />, { auth: authWith(['GIS_READ']) })

    await user.click(await screen.findByRole('tab', { name: 'Analysis history' }))

    expect(await screen.findByText('Manual WKT AOI')).toBeInTheDocument()
    expect(screen.getByText('Maharashtra / Pune')).toBeInTheDocument()
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(await screen.findByText('Analysis result')).toBeInTheDocument()
    expect(screen.getByText(/Stored run/)).toBeInTheDocument()
  })

  it('shows the backend refusal for a Maharashtra village lookup', async () => {
    const user = userEvent.setup()
    let calls = 0
    useStatus()
    server.use(
      http.get(`${API_BASE_URL}/gis/bhuvan/villages/geocode`, ({ request }) => {
        calls += 1
        const url = new URL(request.url)
        expect(url.searchParams.get('village')).toBe('Pune')
        expect(url.searchParams.get('stateCode')).toBe('MH')
        return HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 400,
            error: 'Bad Request',
            message:
              'Bhuvan documents village geocoding and reverse geocoding for Andhra Pradesh and Karnataka only. Maharashtra support has not been verified for this installation, so the call was not sent.',
            path: '/api/v1/gis/bhuvan/villages/geocode',
            fieldErrors: [],
          },
          { status: 400 },
        )
      }),
    )

    renderWithProviders(<BhuvanAnalysisPage />, { auth: authWith(['GIS_READ']) })

    await user.click(await screen.findByRole('tab', { name: 'Village lookup' }))
    await user.type(screen.getByLabelText('Village name'), 'Pune')
    await user.click(screen.getByRole('button', { name: 'Geocode village' }))

    expect(await screen.findByText('Village lookup failed')).toBeInTheDocument()
    expect(screen.getByText(/Maharashtra support has not been verified/)).toBeInTheDocument()
    expect(calls).toBe(1)
  })

  it('shows village records for a documented state without exposing any token', async () => {
    const user = userEvent.setup()
    useStatus()
    server.use(
      http.get(`${API_BASE_URL}/gis/bhuvan/villages/geocode`, () =>
        HttpResponse.json({
          query: 'SEKURU',
          endpoint: '/api_proximity/curl_village_geocode.php',
          stateCode: 'AP',
          maharashtraVerified: false,
          coverageNote: 'Bhuvan documents village geocoding for Andhra Pradesh and Karnataka only.',
          recordCount: 1,
          records: [{ village_name: 'SEKURU', district_name: 'Krishna' }],
        }),
      ),
    )

    renderWithProviders(<BhuvanAnalysisPage />, { auth: authWith(['GIS_READ']) })

    await user.click(await screen.findByRole('tab', { name: 'Village lookup' }))
    await user.type(screen.getByLabelText('Village name'), 'SEKURU')
    await user.selectOptions(screen.getAllByLabelText('State')[0], 'AP')
    await user.click(screen.getByRole('button', { name: 'Geocode village' }))

    expect(await screen.findByText('Village result for SEKURU')).toBeInTheDocument()
    expect(screen.getByText('village_name')).toBeInTheDocument()
    expect(screen.getAllByText('SEKURU').length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.queryByText(/secret-token/)).not.toBeInTheDocument())
  })
})
