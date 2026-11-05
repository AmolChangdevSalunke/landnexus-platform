/**
 * Permission codes exposed by /auth/me.
 * These are only labels for convenience: the backend remains the authority.
 */
export const PERMISSION = {
  MASTER_DATA_READ: 'MASTER_DATA_READ',
  MASTER_DATA_WRITE: 'MASTER_DATA_WRITE',
  USER_READ: 'USER_READ',
  USER_WRITE: 'USER_WRITE',
  AUDIT_READ: 'AUDIT_READ',
  PROPOSAL_CREATE: 'PROPOSAL_CREATE',
  PROPOSAL_READ_OWN: 'PROPOSAL_READ_OWN',
  PROPOSAL_READ: 'PROPOSAL_READ',
  PROPOSAL_SCRUTINIZE: 'PROPOSAL_SCRUTINIZE',
  PROPOSAL_DECIDE: 'PROPOSAL_DECIDE',
} as const

export type PermissionCode = (typeof PERMISSION)[keyof typeof PERMISSION]

export const PROPOSAL_READ_ANY: readonly string[] = [
  PERMISSION.PROPOSAL_READ,
  PERMISSION.PROPOSAL_READ_OWN,
]
