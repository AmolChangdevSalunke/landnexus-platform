import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { MySurveysPage } from './MySurveysPage'
import { SurveyFormPage } from './SurveyFormPage'
import { API_BASE_URL } from '../../api/client'
import type { CaseResponse } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { PARCEL } from '../landRecords/testFixtures'
import {
  authWith,
  CASE,
  CASE_PARCEL,
  SURVEY,
} from './testFixtures'

const SURVEY_CASE: CaseResponse = {
  ...CASE,
  status: 'SURVEY_IN_PROGRESS',
  availableActions: [],
}

function renderSurveyForm() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/acquisition/:id/surveys/:caseParcelId/new"
        element={<SurveyFormPage />}
      />
    </Routes>,
    {
      auth: authWith(['SURVEY_PERFORM', 'LAND_RECORD_READ', 'ACQUISITION_READ']),
      initialEntries: [`/acquisition/${CASE.id}/surveys/${CASE_PARCEL.id}/new`],
    },
  )
}

function stubSurveyQueries() {
  server.use(
    http.get(`${API_BASE_URL}/acquisition/cases/:id`, () => HttpResponse.json(SURVEY_CASE)),
    http.get(`${API_BASE_URL}/acquisition/cases/:id/parcels`, () =>
      HttpResponse.json([CASE_PARCEL]),
    ),
    http.get(`${API_BASE_URL}/land-records/parcels/:id`, () => HttpResponse.json(PARCEL)),
  )
}

describe('acquisition My surveys worklist', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('resolves the parcel identifier and offers survey entry for an unsurveyed parcel', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/my-assignments`, () =>
        HttpResponse.json([CASE_PARCEL]),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () => HttpResponse.json(PARCEL)),
    )

    renderWithProviders(
      <Routes>
        <Route path="/acquisition/my-surveys" element={<MySurveysPage />} />
      </Routes>,
      {
        auth: authWith([
          'SURVEY_PERFORM',
          'LAND_RECORD_READ',
          'ACQUISITION_READ',
        ]),
        initialEntries: ['/acquisition/my-surveys'],
      },
    )

    expect(await screen.findByText('Gat 123 · Survey 45/2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Record survey' })).toHaveAttribute(
      'href',
      `/acquisition/${CASE.id}/surveys/${CASE_PARCEL.id}/new`,
    )
    expect(screen.getByText('Recorded area')).toBeInTheDocument()
  })

  it('does not offer another survey once one awaits verification', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/my-assignments`, () =>
        HttpResponse.json([{ ...CASE_PARCEL, surveyStatus: 'SUBMITTED' }]),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () => HttpResponse.json(PARCEL)),
    )

    renderWithProviders(
      <Routes>
        <Route path="/acquisition/my-surveys" element={<MySurveysPage />} />
      </Routes>,
      {
        auth: authWith(['SURVEY_PERFORM', 'LAND_RECORD_READ']),
        initialEntries: ['/acquisition/my-surveys'],
      },
    )

    expect(await screen.findByText('Awaiting verification')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Record survey' })).not.toBeInTheDocument()
  })
})

describe('acquisition survey entry', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('requires field notes when the measured area differs by more than 10%', async () => {
    const user = userEvent.setup()
    let submitted = false

    stubSurveyQueries()
    server.use(
      http.post(
        `${API_BASE_URL}/acquisition/cases/:id/parcels/:caseParcelId/surveys`,
        () => {
          submitted = true
          return HttpResponse.json(SURVEY)
        },
      ),
    )

    renderSurveyForm()

    expect(await screen.findByRole('heading', { name: 'Survey details' })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Measured area \(ha\)/), '0.5')
    await user.type(screen.getByLabelText(/GPS latitude/), '18.52')
    await user.type(screen.getByLabelText(/GPS longitude/), '73.85')
    expect(screen.getByLabelText('Field notes (required)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit survey' }))

    expect(
      await screen.findByText(
        'Field notes are required because the measured area differs by more than 10%.',
      ),
    ).toBeInTheDocument()
    expect(submitted).toBe(false)
  })

  it('submits the entered GPS point and shows the photo step', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown = null

    stubSurveyQueries()
    server.use(
      http.post(
        `${API_BASE_URL}/acquisition/cases/:id/parcels/:caseParcelId/surveys`,
        async ({ request }) => {
          receivedBody = await request.json()
          return HttpResponse.json(SURVEY)
        },
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/surveys/:surveyId/photos`, () =>
        HttpResponse.json([]),
      ),
    )

    renderSurveyForm()

    expect(await screen.findByRole('heading', { name: 'Survey details' })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Measured area \(ha\)/), '1.3')
    await user.type(screen.getByLabelText(/GPS latitude/), '18.52')
    await user.type(screen.getByLabelText(/GPS longitude/), '73.85')
    await user.type(
      screen.getByLabelText('Field notes (optional)'),
      'Measured with the field officer present.',
    )
    await user.click(screen.getByRole('button', { name: 'Submit survey' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toMatchObject({
      measuredAreaHa: 1.3,
      gpsLatitude: 18.52,
      gpsLongitude: 73.85,
      fieldNotes: 'Measured with the field officer present.',
    })
    expect(await screen.findByText('Survey submitted')).toBeInTheDocument()
    expect(screen.getByText('Survey photos')).toBeInTheDocument()
  })

  it('asks for browser location only after the explicit button press', async () => {
    const user = userEvent.setup()
    const getCurrentPosition = vi.fn()

    stubSurveyQueries()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })

    renderSurveyForm()

    expect(await screen.findByRole('heading', { name: 'Survey details' })).toBeInTheDocument()
    expect(getCurrentPosition).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('blocks survey entry when the parcel is not assigned to the current user', async () => {
    stubSurveyQueries()
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/parcels`, () =>
        HttpResponse.json([
          {
            ...CASE_PARCEL,
            assignedSurveyorUserId: 'abababab-abab-4bab-8bab-abababababab',
          },
        ]),
      ),
    )

    renderSurveyForm()

    expect(
      await screen.findByText(
        'This parcel is not assigned to you. Only the assigned field officer can record the survey.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit survey' })).not.toBeInTheDocument()
  })
})
