import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { NetworkBanner } from './components/layout/NetworkBanner'
import { ToastHost } from './components/ui/ToastHost'
import { AppRoutes } from './app/router'

export default function App() {
  return (
    <ErrorBoundary>
      <NetworkBanner />
      <AppRoutes />
      <ToastHost />
    </ErrorBoundary>
  )
}
