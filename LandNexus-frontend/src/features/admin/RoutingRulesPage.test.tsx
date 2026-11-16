import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/client'
import type { RoutingRuleResponse } from '../../api/types'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith } from '../landRecords/testFixtures'
import { RoutingRulesPage } from './RoutingRulesPage'

const RULES: RoutingRuleResponse[] = [
  {
    id: 'rule-1',
    name: 'DEMO district decision up to 100 ha',
    minAreaHa: 0,
    maxAreaHa: 100,
    projectType: null,
    decisionLevel: 'DISTRICT',
    active: true,
    note: 'DEMO rule, not official policy',
    createdAt: '2026-01-01T00:00:00Z',
  },
]

describe('RoutingRulesPage', () => {
  it('loads the routing rules and labels demo policy clearly', async () => {
    server.use(
      http.get(`${API_BASE_URL}/projects/routing-rules`, () => HttpResponse.json(RULES)),
    )

    renderWithProviders(<RoutingRulesPage />, {
      auth: authWith(['ROUTING_RULE_READ']),
    })

    expect(await screen.findByText(RULES[0].name)).toBeInTheDocument()
    expect(screen.getByText(/not government policy/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add routing rule' })).not.toBeInTheDocument()
  })

  it('creates a routing rule only after review and confirmation', async () => {
    const user = userEvent.setup()
    let requestBody: unknown
    server.use(
      http.get(`${API_BASE_URL}/projects/routing-rules`, () => HttpResponse.json(RULES)),
      http.post(`${API_BASE_URL}/projects/routing-rules`, async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json(
          {
            ...RULES[0],
            id: 'rule-2',
            name: 'DEMO highway route',
            projectType: 'STATE_HIGHWAY',
          },
          { status: 201 },
        )
      }),
    )

    renderWithProviders(<RoutingRulesPage />, {
      auth: authWith(['ROUTING_RULE_READ', 'ROUTING_RULE_MANAGE']),
    })

    await user.click(await screen.findByRole('button', { name: 'Add routing rule' }))
    const form = await screen.findByRole('dialog', { name: 'Create routing rule' })
    await user.type(within(form).getByLabelText('Rule name'), 'DEMO highway route')
    await user.type(within(form).getByLabelText('Minimum area (ha)'), '0')
    await user.type(within(form).getByLabelText('Maximum area (ha)'), '75')
    await user.selectOptions(within(form).getByLabelText('Project type'), 'STATE_HIGHWAY')
    await user.click(within(form).getByRole('button', { name: 'Review changes' }))

    const confirmation = await screen.findByRole('dialog', { name: 'Apply routing rule changes?' })
    expect(requestBody).toBeUndefined()
    await user.click(within(confirmation).getByRole('button', { name: 'Create rule' }))

    await waitFor(() => {
      expect(requestBody).toEqual({
        name: 'DEMO highway route',
        minAreaHa: 0,
        maxAreaHa: 75,
        projectType: 'STATE_HIGHWAY',
        decisionLevel: 'DISTRICT',
        note: null,
      })
    })
  })
})
