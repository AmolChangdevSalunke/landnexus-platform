import { Badge } from '../../components/ui/Badge'
import type { ProposalStatus } from '../../api/types'
import { PROPOSAL_STATUS_BADGES, PROPOSAL_STATUS_LABELS } from './labels'

export function StatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge variant={PROPOSAL_STATUS_BADGES[status]}>{PROPOSAL_STATUS_LABELS[status]}</Badge>
}
