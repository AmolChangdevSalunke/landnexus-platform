import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { NoticesRegisterPage } from './NoticesRegisterPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, CASE, NOTICE, OBJECTION_MASKED } from './testFixtures'

function renderRegister(initialEntries = ['/acquisition/notices']) {
  return renderWithProviders(
    <Routes>
      <Route path="/acquisition/notices" element={<NoticesRegisterPage />} />
    </Routes>,
    {
      auth: authWith(['ACQUISITION_READ']),
      initialEntries,
    },
  )
}

describe('NoticesRegisterPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('finds a case and opens its notices register', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases`, () =>
        HttpResponse.json({
          content: [CASE],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () =>
        HttpResponse.json([NOTICE]),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/objections`, () =>
        HttpResponse.json([OBJECTION_MASKED]),
      ),
    )

    renderRegister()

    expect(await screen.findByRole('heading', { name: 'Notices register' })).toBeInTheDocument()
    expect(await screen.findByText('ACQ-2026-000001')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open register' }))

    expect(await screen.findByText('Selected case')).toBeInTheDocument()
    expect(await screen.findByText(NOTICE.referenceNumber)).toBeInTheDocument()
    expect(await screen.findByText(OBJECTION_MASKED.objectionNumber)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Print letter' })).toHaveAttribute(
      'href',
      `/acquisition/notices/${CASE.id}/${NOTICE.id}`,
    )
    expect(screen.getByRole('link', { name: 'Open case details' })).toHaveAttribute(
      'href',
      `/acquisition/${CASE.id}`,
    )
  })

  it('opens the selected case from a deep link', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () =>
        HttpResponse.json([NOTICE]),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/objections`, () =>
        HttpResponse.json([]),
      ),
    )

    renderRegister([`/acquisition/notices?caseId=${CASE.id}`])

    expect(await screen.findByText('Selected case')).toBeInTheDocument()
    expect(await screen.findByText(NOTICE.referenceNumber)).toBeInTheDocument()
    expect(await screen.findByText('No objections registered')).toBeInTheDocument()
  })

  it('shows an empty register when the backend has no cases', async () => {
    renderRegister()

    expect(await screen.findByText('No acquisition cases yet')).toBeInTheDocument()
  })
})
