import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { DocumentsTab } from './DocumentsTab'
import { API_BASE_URL } from '../../api/client'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, DOCUMENT, DOCUMENT_OWN, PARCEL } from './testFixtures'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL as typeof URL.createObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL as typeof URL.revokeObjectURL
  vi.restoreAllMocks()
})

describe('DocumentsTab', () => {
  it('uploads a PDF as multipart form data without a manual content type', async () => {
    const user = userEvent.setup()
    let requestSeen = false
    let contentType: string | null = null
    const appendSpy = vi.spyOn(FormData.prototype, 'append')

    server.use(
      http.post(
        `${API_BASE_URL}/land-records/parcels/:id/documents`,
        ({ request }) => {
          requestSeen = true
          contentType = request.headers.get('content-type')
          return HttpResponse.json(DOCUMENT, { status: 201 })
        },
      ),
    )

    renderWithProviders(<DocumentsTab parcel={PARCEL} />, {
      auth: authWith(['DOCUMENT_READ', 'DOCUMENT_UPLOAD']),
    })

    await user.click(await screen.findByRole('button', { name: 'Upload document' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^Title/), '7/12 extract 2025')
    await user.selectOptions(
      within(dialog).getByLabelText(/^Category/),
      'SEVEN_TWELVE_EXTRACT',
    )
    await user.upload(
      within(dialog).getByLabelText(/File/),
      new File(['%PDF-1.4 test'], 'extract.pdf', { type: 'application/pdf' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Upload document' }))

    await waitFor(() => {
      expect(requestSeen).toBe(true)
    })

    expect(appendSpy).toHaveBeenCalledWith('title', '7/12 extract 2025')
    expect(appendSpy).toHaveBeenCalledWith('category', 'SEVEN_TWELVE_EXTRACT')
    const fileCall = appendSpy.mock.calls.find(([name]) => name === 'file')
    expect(fileCall).toBeDefined()
    const uploaded = fileCall?.[1] as File
    expect(uploaded.name).toBe('extract.pdf')
    expect(uploaded.type).toBe('application/pdf')
    expect(contentType).toContain('multipart/form-data')
  })

  it('lets a verifying officer verify a pending document', async () => {
    const user = userEvent.setup()
    let body: unknown = null

    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id/documents`, () =>
        HttpResponse.json([DOCUMENT]),
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

    renderWithProviders(<DocumentsTab parcel={PARCEL} />, {
      auth: authWith(['DOCUMENT_READ', 'DOCUMENT_VERIFY']),
    })

    expect(await screen.findByText(DOCUMENT.title)).toBeInTheDocument()
    expect(screen.getByTitle(DOCUMENT.versions[0].sha256)).toBeInTheDocument()
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

  it('does not offer verification to the uploader of the current version', async () => {
    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id/documents`, () =>
        HttpResponse.json([DOCUMENT_OWN]),
      ),
    )

    renderWithProviders(<DocumentsTab parcel={PARCEL} />, {
      auth: authWith(['DOCUMENT_READ', 'DOCUMENT_VERIFY']),
    })

    expect(
      await screen.findByText(
        'You uploaded this version; another officer must verify it.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })

  it('downloads the current version as an authenticated blob', async () => {
    const user = userEvent.setup()
    let capturedBlob: Blob | null = null
    let downloadedName = ''

    URL.createObjectURL = ((blob: Blob) => {
      capturedBlob = blob
      return 'blob:test'
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        downloadedName = this.download
      },
    )

    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id/documents`, () =>
        HttpResponse.json([DOCUMENT]),
      ),
      http.get(
        `${API_BASE_URL}/land-records/documents/:id/versions/:versionNo/download`,
        () =>
          new HttpResponse('%PDF-1.4 payload', {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="extract.pdf"',
            },
          }),
      ),
    )

    renderWithProviders(<DocumentsTab parcel={PARCEL} />, {
      auth: authWith(['DOCUMENT_READ']),
    })

    await user.click(await screen.findByRole('button', { name: 'Download' }))

    await waitFor(() => {
      expect(capturedBlob).not.toBeNull()
    })
    expect(downloadedName).toBe('extract.pdf')
    expect(await (capturedBlob as unknown as Blob).text()).toBe('%PDF-1.4 payload')
  })
})
