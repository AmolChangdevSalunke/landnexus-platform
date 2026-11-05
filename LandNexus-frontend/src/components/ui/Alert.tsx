import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

const VARIANTS: Record<AlertVariant, { box: string; icon: ReactNode }> = {
  info: {
    box: 'border-blue-200 bg-blue-50 text-blue-900',
    icon: <Info aria-hidden="true" className="h-5 w-5 text-blue-600" />,
  },
  success: {
    box: 'border-success-100 bg-success-50 text-success-700',
    icon: <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-success-600" />,
  },
  warning: {
    box: 'border-warning-100 bg-warning-50 text-warning-700',
    icon: <TriangleAlert aria-hidden="true" className="h-5 w-5 text-warning-600" />,
  },
  error: {
    box: 'border-danger-100 bg-danger-50 text-danger-700',
    icon: <AlertCircle aria-hidden="true" className="h-5 w-5 text-danger-600" />,
  },
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: AlertVariant
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3 text-sm', VARIANTS[variant].box, className)}
    >
      <span className="mt-0.5 shrink-0">{VARIANTS[variant].icon}</span>
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  )
}
