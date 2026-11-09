import { useState } from 'react'
import { Eye } from 'lucide-react'
import { toApiErrorInfo } from '../../api/errors'
import { getLandowner } from '../../api/landRecords'
import type { LandownerResponse } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { shortId } from '../../utils/format'

/**
 * Landowner names are personal data. They are fetched one at a time, only when
 * the user asks, and every view is audited by the backend. Without
 * LANDOWNER_READ the identifier is shown as a masked beneficiary reference.
 */
export function LandownerName({
  landownerId,
  canReadLandowners,
  hiddenLabel = 'Beneficiary (hidden)',
}: {
  landownerId: string
  canReadLandowners: boolean
  hiddenLabel?: string
}) {
  const [revealed, setRevealed] = useState<LandownerResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canReadLandowners) {
    return (
      <span className="text-xs text-slate-500" title={landownerId}>
        {hiddenLabel}
      </span>
    )
  }

  if (revealed) {
    return (
      <div className="min-w-0">
        <p className="font-medium text-navy-900">{revealed.fullName}</p>
        <p className="font-mono text-[10px] text-slate-500" title={landownerId}>
          {shortId(landownerId)}
        </p>
      </div>
    )
  }

  async function reveal() {
    if (isLoading) {
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      setRevealed(await getLandowner(landownerId))
    } catch (caught) {
      setError(toApiErrorInfo(caught).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-w-0">
      <Button
        size="sm"
        variant="outline"
        isLoading={isLoading}
        onClick={() => void reveal()}
        leftIcon={<Eye aria-hidden="true" className="h-3.5 w-3.5" />}
      >
        Reveal name
      </Button>
      <p className="mt-1 font-mono text-[10px] text-slate-500" title={landownerId}>
        {shortId(landownerId)}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-[10px] text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
