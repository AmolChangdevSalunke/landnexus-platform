import { apiClient } from './client'
import type {
  NotificationItem,
  PageResponse,
  UnreadCountResponse,
} from './types'

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<UnreadCountResponse>('/notifications/unread-count')
  return data.unread
}

export async function getNotifications(
  unreadOnly: boolean,
  page: number,
  size: number,
): Promise<PageResponse<NotificationItem>> {
  const { data } = await apiClient.get<PageResponse<NotificationItem>>('/notifications', {
    params: { unreadOnly, page, size },
  })
  return data
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${id}/read`)
  return data
}
