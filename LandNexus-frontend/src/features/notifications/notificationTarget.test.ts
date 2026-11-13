import { describe, expect, it } from 'vitest'
import type { NotificationItem } from '../../api/types'
import { notificationTarget } from './notificationTarget'

const ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function notification(
  entityType: string | null,
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    type: 'WORKFLOW',
    title: 'A notification',
    message: 'A message',
    entityType,
    entityId: ID,
    read: false,
    createdAt: '2026-02-02T10:00:00Z',
    ...overrides,
  }
}

describe('notificationTarget', () => {
  it('opens proposal notifications on the proposal details page', () => {
    expect(notificationTarget(notification('Proposal'))).toBe(`/proposals/${ID}`)
  })

  it('opens project notifications on the project details page', () => {
    expect(notificationTarget(notification('Project'))).toBe(`/projects/${ID}`)
  })

  it('opens acquisition case notifications on the case details page', () => {
    expect(notificationTarget(notification('AcquisitionCase'))).toBe(`/acquisition/${ID}`)
  })

  it('opens compensation valuation notifications on the compensation page', () => {
    expect(notificationTarget(notification('Valuation'))).toBe('/monitoring/compensation')
  })

  it('opens SLA scrutiny notifications on the proposal', () => {
    expect(notificationTarget(notification('PROPOSAL_AWAITING_SCRUTINY'))).toBe(`/proposals/${ID}`)
  })

  it('opens document verification notifications on the document details page', () => {
    expect(notificationTarget(notification('DOCUMENT_AWAITING_VERIFICATION'))).toBe(
      `/land/documents/${ID}`,
    )
  })

  it('falls back to the survey list because surveys have no standalone route', () => {
    expect(notificationTarget(notification('SURVEY_AWAITING_VERIFICATION'))).toBe(
      '/acquisition/my-surveys',
    )
  })

  it('falls back to the case list because objections have no standalone route', () => {
    expect(notificationTarget(notification('OBJECTION_AWAITING_DECISION'))).toBe('/acquisition')
  })

  it('opens the case for an objection window notification', () => {
    expect(notificationTarget(notification('OBJECTION_WINDOW_NOT_CLOSED'))).toBe(`/acquisition/${ID}`)
  })

  it('opens estimate approval notifications on the compensation page', () => {
    expect(notificationTarget(notification('ESTIMATE_AWAITING_APPROVAL'))).toBe(
      '/monitoring/compensation',
    )
  })

  it('opens payment release notifications on the compensation page', () => {
    expect(notificationTarget(notification('PAYMENT_AWAITING_RELEASE'))).toBe(
      '/monitoring/compensation',
    )
  })

  it('opens payment response notifications on the compensation page', () => {
    expect(notificationTarget(notification('PAYMENT_AWAITING_RESPONSE'))).toBe(
      '/monitoring/compensation',
    )
  })

  it('matches entity types case-insensitively and ignores separators', () => {
    expect(notificationTarget(notification('proposal'))).toBe(`/proposals/${ID}`)
    expect(notificationTarget(notification('ACQUISITION_CASE'))).toBe(`/acquisition/${ID}`)
    expect(notificationTarget(notification('valuation'))).toBe('/monitoring/compensation')
  })

  it('can derive the target from the notification type when the entity type is missing', () => {
    expect(notificationTarget(notification(null, { type: 'SLA' }))).toBe('/monitoring/sla')
  })

  it('returns no link for an unknown entity type', () => {
    expect(notificationTarget(notification('UnknownEntity'))).toBeNull()
    expect(notificationTarget(notification(null, { type: 'SOMETHING_NEW' }))).toBeNull()
  })

  it('falls back to the list route when the entity id is missing or malformed', () => {
    expect(notificationTarget(notification('Proposal', { entityId: null }))).toBe('/proposals')
    expect(notificationTarget(notification('Proposal', { entityId: 'not-a-uuid' }))).toBe(
      '/proposals',
    )
    expect(notificationTarget(notification('AcquisitionCase', { entityId: '' }))).toBe(
      '/acquisition',
    )
  })
})
