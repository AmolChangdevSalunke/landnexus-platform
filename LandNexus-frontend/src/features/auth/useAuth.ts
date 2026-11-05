import { useAppSelector } from '../../app/hooks'
import type { CurrentUser } from '../../api/types'

export interface AuthContextValue {
  user: CurrentUser | null
  isAuthenticated: boolean
  can: (permission: string) => boolean
  canAny: (...permissions: string[]) => boolean
  hasRole: (role: string) => boolean
}

/**
 * Reads the current session from Redux. Never decode the JWT for permissions:
 * the backend supplies roles and permissions through /auth/me.
 */
export function useAuth(): AuthContextValue {
  const user = useAppSelector((state) => state.auth.user)

  return {
    user,
    isAuthenticated: Boolean(user),
    can: (permission) => Boolean(user?.permissions.includes(permission)),
    canAny: (...permissions) =>
      permissions.some((permission) => Boolean(user?.permissions.includes(permission))),
    hasRole: (role) => Boolean(user?.roles.includes(role)),
  }
}
