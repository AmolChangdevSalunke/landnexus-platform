import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/client'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith } from '../landRecords/testFixtures'
import { ImageryStatusCard } from './ImageryStatusCard'
import { SatellitePreview } from './SatellitePreview'

/* jsdom does not implement object URLs; the browser always does. */
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:satellite-test')
  URL.revokeObjectURL = vi.fn()
})

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

const PARCEL_GEOMETRY = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [73.85, 19.87],
      [73.86, 19.87],
      [73.86, 19.88],
      [73.85, 19.88],
      [73.85, 19.87],
    ],
  ],
}

function enableImagery() {
  server.use(
    http.get(`${API_BASE_URL}/gis/imagery/status`, () =>
      HttpResponse.json({
        enabled: true,
        provider: 'ISRO Bhuvan',
        kind: 'WMS',
        overlayAvailable: true,
        attribution: 'ISRO Bhuvan',
        message: 'Satellite imagery is enabled (ISRO Bhuvan).',
      }),
    ),
  )
}

function servePicture() {
  server.use(
    http.get(`${API_BASE_URL}/gis/imagery/map`, () =>
      HttpResponse.arrayBuffer(new Uint8Array([137, 80, 78, 71]).buffer, {
        headers: { 'Content-Type': 'image/png' },
      }),
    ),
  )
}

describe('ImageryStatusCard', () => {
  it('shows the server status and message when imagery is disabled', async () => {
    renderWithProviders(<ImageryStatusCard />, { auth: authWith(['GIS_READ']) })

    expect(await screen.findByRole('heading', { name: 'Satellite imagery' })).toBeInTheDocument()
    expect(screen.getByText('Not enabled')).toBeInTheDocument()
    expect(screen.getByText('ISRO Bhuvan')).toBeInTheDocument()
    expect(
      screen.getByText(/follow docs\/IMAGERY_SETUP\.md/),
    ).toBeInTheDocument()

    // SETTINGS_MANAGE is required for the provider test.
    expect(screen.queryByRole('button', { name: 'Test provider' })).not.toBeInTheDocument()
  })

  it('runs the provider test for settings managers and shows the result', async () => {
    const user = userEvent.setup()

    server.use(
      http.post(`${API_BASE_URL}/gis/imagery/test`, () =>
        HttpResponse.json({
          ok: true,
          connectionState: 'CONNECTED',
          httpStatus: 200,
          contentType: 'image/png',
          bytes: 1234,
          elapsedMs: 87,
          message: 'The provider answered with a picture.',
        }),
      ),
    )

    renderWithProviders(<ImageryStatusCard />, {
      auth: authWith(['GIS_READ', 'SETTINGS_MANAGE']),
    })

    await user.click(await screen.findByRole('button', { name: 'Test provider' }))

    expect(await screen.findByText('BHUVAN CONNECTED')).toBeInTheDocument()
    expect(screen.getByText('HTTP 200')).toBeInTheDocument()
    expect(screen.getByText('image/png')).toBeInTheDocument()
    expect(screen.getByText(/answered with a picture/)).toBeInTheDocument()
  })

  it('distinguishes Bhuvan authentication failure from general unavailability', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${API_BASE_URL}/gis/imagery/test`, () =>
        HttpResponse.json({
          ok: false,
          connectionState: 'AUTHENTICATION_FAILED',
          httpStatus: 403,
          contentType: null,
          bytes: 0,
          elapsedMs: 42,
          message: 'The imagery service rejected authentication (HTTP 403)',
        }),
      ),
    )

    renderWithProviders(<ImageryStatusCard />, {
      auth: authWith(['GIS_READ', 'SETTINGS_MANAGE']),
    })
    await user.click(await screen.findByRole('button', { name: 'Test provider' }))

    expect(await screen.findByText('BHUVAN AUTHENTICATION FAILED')).toBeInTheDocument()
    expect(screen.getByText('HTTP 403')).toBeInTheDocument()
  })

  it('renders nothing without GIS_READ', () => {
    const { container } = renderWithProviders(<ImageryStatusCard />, {
      auth: authWith(['SETTINGS_MANAGE']),
    })

    expect(container).toBeEmptyDOMElement()
  })
})

describe('SatellitePreview', () => {
  it('shows the server message and keeps the page usable when imagery is disabled', async () => {
    renderWithProviders(
      <SatellitePreview geometry={PARCEL_GEOMETRY} label="Test satellite preview" />,
      { auth: authWith(['GIS_READ']) },
    )

    expect(
      await screen.findByRole('heading', { name: 'Satellite picture' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Satellite imagery is not enabled')).toBeInTheDocument()
    expect(screen.getByText(/docs\/IMAGERY_SETUP\.md/)).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'Test satellite preview' }),
    ).not.toBeInTheDocument()
  })

  it('loads the picture through the backend when imagery is enabled', async () => {
    enableImagery()
    servePicture()

    renderWithProviders(
      <SatellitePreview geometry={PARCEL_GEOMETRY} label="Test satellite preview" />,
      { auth: authWith(['GIS_READ']) },
    )

    const picture = await screen.findByRole('img', { name: 'Test satellite preview' })
    expect(picture).toBeInTheDocument()
    expect(picture).toHaveAttribute('src', 'blob:satellite-test')
    expect(screen.getByText('Imagery: ISRO Bhuvan')).toBeInTheDocument()
  })

  it('degrades to a note when the picture request fails', async () => {
    enableImagery()
    server.use(
      http.get(`${API_BASE_URL}/gis/imagery/map`, () =>
        HttpResponse.json(
          { status: 503, message: 'Satellite imagery is not enabled on this server' },
          { status: 503 },
        ),
      ),
    )

    renderWithProviders(
      <SatellitePreview geometry={PARCEL_GEOMETRY} label="Test satellite preview" />,
      { auth: authWith(['GIS_READ']) },
    )

    expect(await screen.findByText('The picture could not be loaded')).toBeInTheDocument()
    expect(
      screen.getByText(/Satellite imagery is not enabled on this server/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'Test satellite preview' }),
    ).not.toBeInTheDocument()
  })

  it('renders nothing when there is no recorded geometry', () => {
    const { container } = renderWithProviders(
      <SatellitePreview geometry={null} label="Test satellite preview" />,
      { auth: authWith(['GIS_READ']) },
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('never asks the server for an oversized bounding box', async () => {
    enableImagery()
    const pictureUrls: string[] = []
    server.use(
      http.get(`${API_BASE_URL}/gis/imagery/map`, ({ request }) => {
        pictureUrls.push(request.url)
        return HttpResponse.arrayBuffer(new Uint8Array([1]).buffer, {
          headers: { 'Content-Type': 'image/png' },
        })
      }),
    )

    renderWithProviders(
      <SatellitePreview
        geometry={{
          type: 'LineString',
          coordinates: [
            [73.8, 19.8],
            [79.0, 19.9],
          ],
        }}
        label="Test satellite preview"
      />,
      { auth: authWith(['GIS_READ']) },
    )

    expect(
      await screen.findByText('Picture not available for this shape'),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(pictureUrls).toHaveLength(0)
    })
  })
})
