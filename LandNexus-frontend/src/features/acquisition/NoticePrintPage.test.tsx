import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { NoticePrintPage } from './NoticePrintPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, CASE, NOTICE } from './testFixtures'

function renderLetter(caseId = CASE.id, noticeId = NOTICE.id) {
  return renderWithProviders(
    <Routes>
      <Route path="/acquisition/notices/:caseId/:noticeId" element={<NoticePrintPage />} />
    </Routes>,
    {
      auth: authWith(['ACQUISITION_READ']),
      initialEntries: [`/acquisition/notices/${caseId}/${noticeId}`],
    },
  )
}

describe('NoticePrintPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the notice letter and prints it', async () => {
    const user = userEvent.setup()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () =>
        HttpResponse.json([NOTICE]),
      ),
    )

    renderLetter()

    expect(
      await screen.findByRole('heading', { name: 'Preliminary notification', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText(`Reference ${NOTICE.referenceNumber} · Issued on 10 Feb 2026`))
      .toBeInTheDocument()
    expect(screen.getByText('ACQ-2026-000001')).toBeInTheDocument()
    /* The label is bolded inside a span, so the date is its own text node. */
    expect(screen.getByText('Objection period ends on:')).toBeInTheDocument()
    expect(screen.getByText('25 Feb 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Print this notice' }))

    expect(printSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Back to register' })).toHaveAttribute(
      'href',
      `/acquisition/notices?caseId=${CASE.id}`,
    )
  })

  it('shows a not found state for a notice outside the case record', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () =>
        HttpResponse.json([]),
      ),
    )

    renderLetter(CASE.id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')

    expect(await screen.findByText('Notice not found')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: "Back to this case's register" }),
    ).toHaveAttribute('href', `/acquisition/notices?caseId=${CASE.id}`)
  })
})
