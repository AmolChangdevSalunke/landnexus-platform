import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}) {
  const dimensions = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center', className)}>
      <Loader2 aria-hidden="true" className={cn('animate-spin text-blue-600', dimensions)} />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function FullPageLoader({ label = 'Loading LandNexus' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner size="lg" label={label} />
        <p className="text-sm font-medium text-slate-600">{label}…</p>
      </div>
    </div>
  )
}
