import type { NotificationItem } from '../../api/types'

/** The backend decides the entity type; unknown types simply have no link. */
export function notificationTarget(notification: NotificationItem): string | null {
  if (!notification.entityId) {
    return null
  }

  switch (notification.entityType) {
    case 'Proposal':
      return `/proposals/${notification.entityId}`
    case 'Project':
      return `/projects/${notification.entityId}`
    default:
      return null
  }
}

export function notificationTypeLabel(type: string): string {
  const words = type.replaceAll('_', ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
