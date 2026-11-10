import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { RrCaseDetailPage } from './RrCaseDetailPage'
import { API_BASE_URL } from '../../api/client'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, CASE } from '../acquisition/testFixtures'
import { RR_CASE } from './testFixtures'

function renderRecord(permissions: string[] = ['RR_READ']) {
  return renderWithProviders(
    <Routes>
      <Route path="/compensation/rr-cases/:id" element={<RrCaseDetailPage />} />
    </Routes>,
    {
      auth: authWith(permissions),
      initialEntries: [`/compensation/rr-cases/${RR_CASE.id}`],
    },
  )
}

describe('RrCaseDetailPage', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_BASE_URL}/compensation/rr-cases/:id`, () =>
        HttpResponse.json(RR_CASE),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
    )
  })

  it('shows the recorded facts, the case and every benefit from the server', async () => {
    renderRecord()

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent === 'Lost their home · Livelihood not lost',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(RR_CASE.notes as string)).toBeInTheDocument()
    expect(await screen.findByText(new RegExp(CASE.caseNumber))).toBeInTheDocument()
    expect(screen.getByText('Housing unit')).toBeInTheDocument()
    expect(screen.getByText('Benefits recorded for this family')).toBeInTheDocument()
  })

  it('keeps the beneficiary hidden without LANDOWNER_READ', async () => {
    renderRecord()

    await screen.findByText('Housing unit')
    expect(screen.getByText('Beneficiary (hidden)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
  })

  it('links back to the case', async () => {
    renderRecord()

    await screen.findByText('Housing unit')
    expect(screen.getByRole('link', { name: 'Back to case' })).toHaveAttribute(
      'href',
      `/acquisition/${RR_CASE.caseId}`,
    )
  })

  it('shows a not found state for a missing family', async () => {
    server.use(
      http.get(`${API_BASE_URL}/compensation/rr-cases/:id`, ({ request }) =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 404,
            error: 'Not Found',
            message: 'R&R case not found.',
            path: new URL(request.url).pathname,
            fieldErrors: [],
          },
          { status: 404 },
        ),
      ),
    )

    renderRecord()

    expect(await screen.findByText('Family not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to cases' })).toBeInTheDocument()
  })
})
