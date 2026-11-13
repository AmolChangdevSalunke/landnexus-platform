import type { NotificationItem } from '../../api/types'

/**
 * Notification entity types are decided by the backend and are not consistently
 * cased (`Proposal` from ProposalService, `PROPOSAL_AWAITING_SCRUTINY` from the
 * SLA scanner). Matching is therefore case-insensitive and ignores separators.
 *
 * A `detail` builder is used only when the entity id is the id of a routable
 * detail record. When the id is missing or malformed we fall back to the
 * matching list screen instead of generating a broken URL.
 */
interface TargetRule {
  fallback: string
  detail?: (id: string) => string
}

const RULES: Record<string, TargetRule> = {
  // Workflow notifications.
  proposal: { fallback: '/proposals', detail: (id) => `/proposals/${id}` },
  project: { fallback: '/projects', detail: (id) => `/projects/${id}` },
  acquisitioncase: { fallback: '/acquisition', detail: (id) => `/acquisition/${id}` },
  landdocument: { fallback: '/land/documents', detail: (id) => `/land/documents/${id}` },
  document: { fallback: '/land/documents', detail: (id) => `/land/documents/${id}` },

  // Compensation notifications. Valuations and payments are reviewed from the
  // compensation monitoring page: there is no per-estimate route.
  valuation: { fallback: '/monitoring/compensation' },
  compensation: { fallback: '/monitoring/compensation' },
  estimateawaitingapproval: { fallback: '/monitoring/compensation' },
  paymentawaitingrelease: { fallback: '/monitoring/compensation' },
  paymentawaitingresponse: { fallback: '/monitoring/compensation' },

  // SLA scanner notifications. The entity id is the id named by the item type.
  sla: { fallback: '/monitoring/sla' },
  proposalawaitingscrutiny: { fallback: '/proposals', detail: (id) => `/proposals/${id}` },
  documentawaitingverification: {
    fallback: '/land/documents',
    detail: (id) => `/land/documents/${id}`,
  },
  surveyawaitingverification: { fallback: '/acquisition/my-surveys' },
  objectionawaitingdecision: { fallback: '/acquisition' },
  objectionwindownotclosed: { fallback: '/acquisition', detail: (id) => `/acquisition/${id}` },

  // Defensive aliases for the short entity names used by acquisition services.
  survey: { fallback: '/acquisition/my-surveys' },
  objection: { fallback: '/acquisition' },
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalize(value: string | null): string {
  return (value ?? '').trim().toLowerCase().replaceAll(/[\s_-]+/g, '')
}

function safeId(value: string | null): string | null {
  const id = value?.trim()
  return id && UUID_PATTERN.test(id) ? id : null
}

/**
 * Resolve the frontend destination for a notification. Unknown entity types
 * deliberately return `null`: the notification remains readable but has no
 * broken "Open" link.
 */
export function notificationTarget(notification: NotificationItem): string | null {
  const explicitType = normalize(notification.entityType)
  // Older rows may not carry an entity type: the notification type is a safe
  // second source of truth for those.
  const key = explicitType || normalize(notification.type)
  const rule = RULES[key]

  if (!rule) {
    return null
  }

  const id = safeId(notification.entityId)
  if (rule.detail && id) {
    return rule.detail(id)
  }

  return rule.fallback
}

export function notificationTypeLabel(type: string): string {
  const words = type.replaceAll('_', ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
