import type { ProjectStatus } from '../../api/types'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
}
