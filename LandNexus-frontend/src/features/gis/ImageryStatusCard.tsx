import { useState } from 'react'
import { FlaskConical, Satellite } from 'lucide-react'
import { getImageryStatus, testImagery } from '../../api/gis'
import type { ImageryTestResult } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatNumber } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'

/**
 * Server-side imagery summary shown on the GIS map. The provider URL and its
 * secret never reach the browser; SETTINGS_MANAGE holders may run a provider
 * test that returns only pass or fail details.
 */
export function ImageryStatusCard() {
  const { can } = useAuth()
  const canRead = can(PERMISSION.GIS_READ)
  const canTest = can(PERMISSION.SETTINGS_MANAGE)

  const statusQuery = useApiQuery(() => getImageryStatus(), [], canRead)
  const mutation = useApiMutation<ImageryTestResult>()
  const [result, setResult] = useState<ImageryTestResult | null>(null)

  if (!canRead) {
    return null
  }

  const status = statusQuery.data
  const testBusy = mutation.isLoading

  async function runTest() {
    if (testBusy) {
      return
    }
    try {
      setResult(await mutation.mutate(() => testImagery()))
    } catch {
      setResult(null)
    }
  }

  return (
    <Card className="p-4">
      <CardHeader
        title="Satellite imagery"
        description="The backend fetches pictures from the configured provider on behalf of the browser."
        action={
          status ? (
            status.enabled ? (
              <Badge variant="success">Enabled</Badge>
            ) : (
              <Badge variant="warning">Not enabled</Badge>
            )
          ) : undefined
        }
      />

      <div className="mt-4">
        {statusQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : statusQuery.error ? (
          <Alert variant="warning" title="Imagery status could not be loaded">
            {statusQuery.error.message}
          </Alert>
        ) : status ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Provider
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {status.provider && status.provider.trim() ? (
                    status.provider
                  ) : (
                    <span className="text-slate-500">Not configured</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Service type
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {status.kind ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Overlay layer
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {status.overlayAvailable ? (
                    <Badge variant="info">Available</Badge>
                  ) : (
                    <Badge variant="neutral">Not configured</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Attribution
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {status.attribution && status.attribution.trim()
                    ? status.attribution
                    : '—'}
                </dd>
              </div>
            </dl>

            {status.message ? (
              <Alert variant={status.enabled ? 'info' : 'warning'}>
                {status.message}
              </Alert>
            ) : null}

            {canTest ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void runTest()}
                  isLoading={testBusy}
                  leftIcon={
                    testBusy ? undefined : (
                      <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
                    )
                  }
                >
                  Test provider
                </Button>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Satellite aria-hidden="true" className="h-3.5 w-3.5" />
                  Asks the provider for a tiny picture.
                </span>
              </div>
            ) : null}

            {mutation.error ? (
              <Alert variant="error" title="The provider test could not be run">
                {mutation.error.message}
              </Alert>
            ) : null}

            {result ? (
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                aria-live="polite"
              >
                <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                  {result.connectionState === 'CONNECTED' ? (
                    <Badge variant="success">
                      {status.provider?.toLocaleUpperCase().includes('BHUVAN')
                        ? 'BHUVAN CONNECTED'
                        : 'Provider reachable'}
                    </Badge>
                  ) : result.connectionState === 'AUTHENTICATION_FAILED' ? (
                    <Badge variant="danger">
                      {status.provider?.toLocaleUpperCase().includes('BHUVAN')
                        ? 'BHUVAN AUTHENTICATION FAILED'
                        : 'Provider authentication failed'}
                    </Badge>
                  ) : (
                    <Badge variant="danger">
                      {status.provider?.toLocaleUpperCase().includes('BHUVAN')
                        ? 'BHUVAN UNAVAILABLE'
                        : 'Provider not reachable'}
                    </Badge>
                  )}
                  {result.httpStatus !== null ? (
                    <span className="text-xs text-slate-600">
                      HTTP {result.httpStatus}
                    </span>
                  ) : null}
                  {result.contentType ? (
                    <span className="text-xs text-slate-600">
                      {result.contentType}
                    </span>
                  ) : null}
                  {result.bytes > 0 ? (
                    <span className="text-xs text-slate-600">
                      {formatNumber(result.bytes)} bytes
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-600">
                    {formatNumber(result.elapsedMs)} ms
                  </span>
                </p>
                {result.message ? (
                  <p className="mt-1 text-sm text-slate-700">{result.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
