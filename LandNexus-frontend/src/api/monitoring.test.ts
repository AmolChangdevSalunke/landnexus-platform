import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { runReport } from './monitoring'
import { API_BASE_URL } from './client'
import { server } from '../test/server'

describe('monitoring report API', () => {
  it('sends all supported report filters as query parameters', async () => {
    let received: URLSearchParams | null = null
    server.use(
      http.get(`${API_BASE_URL}/monitoring/reports/PROJECTS`, ({ request }) => {
        received = new URL(request.url).searchParams
        return HttpResponse.json({
          code: 'PROJECTS',
          title: 'Projects',
          columns: [],
          rows: [],
          page: 1,
          size: 10,
          totalRows: 0,
        })
      }),
    )

    await runReport('PROJECTS', {
      stateId: 'state-id',
      districtId: 'district-id',
      talukaId: 'taluka-id',
      projectId: 'project-id',
      status: 'ACTIVE',
      fromDate: '2026-01-01',
      toDate: '2026-06-30',
      page: 1,
      size: 10,
    })

    expect(received).not.toBeNull()
    expect(Object.fromEntries(received!)).toEqual({
      status: 'ACTIVE',
      stateId: 'state-id',
      districtId: 'district-id',
      talukaId: 'taluka-id',
      projectId: 'project-id',
      fromDate: '2026-01-01',
      toDate: '2026-06-30',
      page: '1',
      size: '10',
    })
  })
})
