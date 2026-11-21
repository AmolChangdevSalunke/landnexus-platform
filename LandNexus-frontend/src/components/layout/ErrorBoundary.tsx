import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { createLogger } from '../../logging/logger'
import { Button } from '../ui/Button'

const log = createLogger('ui.error-boundary')

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Error messages and component stacks are safe; tokens and user data are not collected here.
    log.error('Unhandled UI error', {
      error,
      detail: info.componentStack?.slice(0, 500),
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
              <AlertTriangle aria-hidden="true" className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-navy-900">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The page could not be displayed. Reload the application to continue. If the
              problem persists, contact your administrator.
            </p>
            <Button
              className="mt-6"
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
            >
              Reload application
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
