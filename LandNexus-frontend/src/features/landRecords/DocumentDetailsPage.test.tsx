import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { DocumentDetailsPage } from './DocumentDetailsPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, DOCUMENT, PARCEL } from './testFixtures'

function renderDetails(
  documentId = DOCUMENT.id,
  permissions = ['DOCUMENT_READ', 'DOCUMENT_UPLOAD', 'DOCUMENT_VERIFY'],
) {
  return renderWithProviders(
    <Routes>
      <Route path="/land/documents/:id" element={<DocumentDetailsPage />} />
    </Routes>,
    {
      auth: authWith(permissions),
      initialEntries: [`/land/documents/${documentId}`],
    },
  )
}

describe('DocumentDetailsPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('shows document metadata and version history', async () => {
    server.use(
      http.get(`${API_BASE_URL}/land-records/documents/:id`, () =>
        HttpResponse.json(DOCUMENT),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () =>
        HttpResponse.json(PARCEL),
      ),
    )

    renderDetails()

    expect(await screen.findByRole('heading', { name: DOCUMENT.title })).toBeInTheDocument()
    expect(screen.getByText('Document details')).toBeInTheDocument()
    expect(screen.getByText('Version history (1)')).toBeInTheDocument()
    expect(screen.getAllByText('extract.pdf').length).toBeGreaterThan(0)
    expect(screen.getAllByTitle(DOCUMENT.versions[0].sha256).length).toBeGreaterThan(0)
  })

  it('verifies a pending document with remarks', async () => {
    const user = userEvent.setup()
    let body: unknown = null

    server.use(
      http.get(`${API_BASE_URL}/land-records/documents/:id`, () =>
        HttpResponse.json(DOCUMENT),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () =>
        HttpResponse.json(PARCEL),
      ),
      http.post(
        `${API_BASE_URL}/land-records/documents/:id/verify`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({
            ...DOCUMENT,
            verificationStatus: 'VERIFIED',
            verificationRemarks: 'Checked against the register.',
          })
        },
      ),
    )

    renderDetails()

    await screen.findByRole('heading', { name: DOCUMENT.title })
    await user.click(screen.getByRole('button', { name: 'Verify' }))

    const dialog = screen.getByRole('dialog')
    await user.type(
      within(dialog).getByLabelText(/^Remarks/),
      'Checked against the register.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(body).toEqual({ remarks: 'Checked against the register.' })
    })
  })

  it('shows a not found state for a missing document', async () => {
    server.use(
      http.get(`${API_BASE_URL}/land-records/documents/:id`, ({ request }) =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 404,
            error: 'Not Found',
            message: 'Document not found.',
            path: new URL(request.url).pathname,
            fieldErrors: [],
          },
          { status: 404 },
        ),
      ),
    )

    renderDetails()

    expect(await screen.findByText('Document not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to document register' })).toBeInTheDocument()
  })
})
