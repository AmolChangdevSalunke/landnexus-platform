import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { RuleSetDetailPage } from './RuleSetDetailPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith } from '../acquisition/testFixtures'
import { RULE_SET } from './testFixtures'

function renderRecord() {
  return renderWithProviders(
    <Routes>
      <Route path="/compensation/rule-sets/:id" element={<RuleSetDetailPage />} />
    </Routes>,
    {
      auth: authWith(['VALUATION_READ']),
      initialEntries: [`/compensation/rule-sets/${RULE_SET.id}`],
    },
  )
}

describe('RuleSetDetailPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
    server.use(
      http.get(`${API_BASE_URL}/compensation/rule-sets/:id`, () =>
        HttpResponse.json(RULE_SET),
      ),
    )
  })

  it('shows the definition and the components the server returned', async () => {
    renderRecord()

    expect(await screen.findByText(RULE_SET.name)).toBeInTheDocument()
    expect(screen.getByText('Nationwide')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('LAND_BASE')).toBeInTheDocument()
    /* The component name and the component type label are both "Land value". */
    expect(screen.getAllByText('Land value').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/open ended/).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Right to Fair Compensation and Transparency/),
    ).toBeInTheDocument()
  })

  it('links back to the rate cards and rule sets page', async () => {
    renderRecord()

    await screen.findByText(RULE_SET.name)
    expect(screen.getByRole('link', { name: 'Back to rate cards and rule sets' })).toHaveAttribute(
      'href',
      '/compensation/rules',
    )
  })

  it('shows a not found state for a missing rule set', async () => {
    server.use(
      http.get(`${API_BASE_URL}/compensation/rule-sets/:id`, ({ request }) =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 404,
            error: 'Not Found',
            message: 'Rule set not found.',
            path: new URL(request.url).pathname,
            fieldErrors: [],
          },
          { status: 404 },
        ),
      ),
    )

    renderRecord()

    expect(await screen.findByText('Rule set not found')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to rate cards and rule sets' }),
    ).toBeInTheDocument()
  })
})
