import type { ReactNode } from 'react'
import { Filter, RotateCcw } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDateTime } from '../../utils/format'
import type { Dashboard } from '../../api/types'
import type { MonitoringScope } from './scope'

/**
 * State and district filters. They are only offered when reference data is
 * readable; otherwise the screens simply stay on the user's own geo scope.
 */
export function MonitoringFilters({
  scope,
  children,
}: {
  scope: MonitoringScope
  children?: ReactNode
}) {
  const refs = useReferenceNames()
  const districts = scope.stateId
    ? refs.districts.filter((district) => district.stateId === scope.stateId)
    : refs.districts

  return (
    <Card className="mb-5 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-700 lg:w-28">
          <Filter aria-hidden="true" className="h-4 w-4 text-slate-500" />
          Filters
        </div>

        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {refs.enabled ? (
            <>
              <Select
                label="State"
                value={scope.stateId}
                onChange={(event) => scope.setStateId(event.target.value)}
              >
                <option value="">All states in my scope</option>
                {refs.states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </Select>

              <Select
                label="District"
                value={scope.districtId}
                onChange={(event) => scope.setDistrictId(event.target.value)}
              >
                <option value="">All districts in scope</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <p className="self-end pb-2 text-xs text-slate-500 sm:col-span-2">
              State and district filters need master-data access. Figures remain limited to
              your own geographic scope.
            </p>
          )}
          {children}
        </div>

        {scope.hasScope ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={scope.clearScope}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Reset
          </Button>
        ) : null}
      </div>

      {refs.enabled && refs.error ? (
        <p className="mt-2 text-xs text-danger-700">
          Reference data could not be loaded: {refs.error.message}
        </p>
      ) : null}
    </Card>
  )
}

const LEVEL_LABELS: Record<Dashboard['level'], string> = {
  NATIONAL: 'National',
  STATE: 'State',
  DISTRICT: 'District',
  SCOPED: 'My scope',
}

const LEVEL_VARIANTS: Record<Dashboard['level'], 'info' | 'indigo' | 'teal' | 'neutral'> = {
  NATIONAL: 'indigo',
  STATE: 'info',
  DISTRICT: 'teal',
  SCOPED: 'neutral',
}

/** One line describing what the numbers cover and when they were generated. */
export function ScopeSummary({
  level,
  generatedAt,
  stateId,
  districtId,
}: {
  level: Dashboard['level']
  generatedAt: string
  stateId: string
  districtId: string
}) {
  const refs = useReferenceNames()
  const stateName = stateId ? refs.stateName(stateId) : null
  const districtName = districtId ? refs.districtName(districtId) : null
  const place = [stateName ?? (stateId ? 'selected state' : null), districtName ?? (districtId ? 'selected district' : null)]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
      <Badge variant={LEVEL_VARIANTS[level]}>{LEVEL_LABELS[level]}</Badge>
      <span>{place || 'All records inside your geographic scope'}</span>
      <span className="text-slate-400" aria-hidden="true">
        |
      </span>
      <span>Generated {formatDateTime(generatedAt)}</span>
    </div>
  )
}
