import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { NETWORK_ERROR_EVENT, NETWORK_OK_EVENT } from '../../api/client'

export function NetworkBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function show() {
      setVisible(true)
    }
    function hide() {
      setVisible(false)
    }

    window.addEventListener(NETWORK_ERROR_EVENT, show)
    window.addEventListener(NETWORK_OK_EVENT, hide)
    return () => {
      window.removeEventListener(NETWORK_ERROR_EVENT, show)
      window.removeEventListener(NETWORK_OK_EVENT, hide)
    }
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-3 bg-warning-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      <WifiOff aria-hidden="true" className="h-4 w-4" />
      <span>Backend unreachable. Some information may not load.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
      >
        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  )
}
