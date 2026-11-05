import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { IconButton } from './IconButton'

export interface CopyButtonProps {
  value: string
  label: string
}

/** Copies a value to the clipboard without showing the value in the button. */
export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      // Clipboard access can be refused by the browser. Nothing is lost.
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <IconButton label={`Copy ${label}`} onClick={() => void handleCopy()}>
        {copied ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Copy aria-hidden="true" className="h-4 w-4" />
        )}
      </IconButton>
      <span aria-live="polite" className="text-xs text-slate-500">
        {copied ? 'Copied' : null}
      </span>
    </span>
  )
}
