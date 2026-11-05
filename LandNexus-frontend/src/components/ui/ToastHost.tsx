import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { removeToast, type ToastMessage, type ToastVariant } from '../../app/toastsSlice'
import { cn } from '../../utils/cn'

const VARIANTS: Record<ToastVariant, { box: string; icon: typeof Info }> = {
  success: { box: 'border-success-100 bg-white text-success-700', icon: CheckCircle2 },
  error: { box: 'border-danger-100 bg-white text-danger-700', icon: AlertCircle },
  warning: { box: 'border-warning-100 bg-white text-warning-700', icon: TriangleAlert },
  info: { box: 'border-blue-200 bg-white text-blue-700', icon: Info },
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dispatch = useAppDispatch()
  const { box, icon: Icon } = VARIANTS[toast.variant]

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dispatch(removeToast(toast.id))
    }, 5_000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [dispatch, toast.id])

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-3 text-sm shadow-lg',
        box,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="font-semibold">{toast.title}</p> : null}
        <p className="text-slate-700">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dispatch(removeToast(toast.id))}
        aria-label="Dismiss notification"
        className="rounded p-1 text-slate-500 hover:bg-slate-100"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastHost() {
  const toasts = useAppSelector((state) => state.toasts.items)

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
