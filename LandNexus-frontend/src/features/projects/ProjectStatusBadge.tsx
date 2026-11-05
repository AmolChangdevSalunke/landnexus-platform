import type { ProjectStatus } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { PROJECT_STATUS_LABELS } from './labels'

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={status === 'ACTIVE' ? 'success' : 'neutral'}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  )
}
