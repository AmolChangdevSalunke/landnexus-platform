import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'
import { NoAccessPage } from './NoAccessPage'

export function RequirePermission({
  any,
  children,
}: {
  any: string[]
  children?: ReactNode
}) {
  const { canAny } = useAuth()

  if (!canAny(...any)) {
    return <NoAccessPage />
  }

  return <>{children ?? <Outlet />}</>
}
