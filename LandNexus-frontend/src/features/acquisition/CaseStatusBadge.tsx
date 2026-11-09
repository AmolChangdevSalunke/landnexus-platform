import type { CaseStatus } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { CASE_STATUS_LABELS, CASE_STATUS_VARIANTS } from './labels'

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge variant={CASE_STATUS_VARIANTS[status]}>{CASE_STATUS_LABELS[status]}</Badge>
  )
}
