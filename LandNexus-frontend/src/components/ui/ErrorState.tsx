import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from './Button'

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertTriangle aria-hidden="true" className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      {onRetry ? (
        <Button
          variant="outline"
          className="mt-5"
          onClick={onRetry}
          leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  )
}
