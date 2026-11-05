import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageLoader } from '../../components/ui/Spinner'
import { useAppSelector } from '../../app/hooks'

export function ProtectedRoute() {
  const user = useAppSelector((state) => state.auth.user)
  const status = useAppSelector((state) => state.auth.status)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return <FullPageLoader label="Restoring your session" />
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
