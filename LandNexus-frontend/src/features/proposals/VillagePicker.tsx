import { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { TalukaResponse, VillageResponse } from '../../api/types'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../utils/cn'

export interface VillageGroup {
  taluka: TalukaResponse
  villages: VillageResponse[]
}

export interface VillagePickerProps {
  groups: VillageGroup[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  isLoading?: boolean
  error?: string | null
  disabled?: boolean
  fieldError?: string
}

const MAX_VILLAGES = 500

function matchesSearch(village: VillageResponse, term: string): boolean {
  const normalized = term.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  return (
    village.name.toLowerCase().includes(normalized) ||
    village.code.toLowerCase().includes(normalized)
  )
}

export function VillagePicker({
  groups,
  selectedIds,
  onChange,
  isLoading = false,
  error = null,
  disabled = false,
  fieldError,
}: VillagePickerProps) {
  const [search, setSearch] = useState('')
  const searchId = useId()
  const errorId = useId()

  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          villages: group.villages.filter((village) => matchesSearch(village, search)),
        }))
        .filter((group) => group.villages.length > 0 || !search.trim()),
    [groups, search],
  )

  function toggleVillage(villageId: string) {
    if (selected.has(villageId)) {
      onChange(selectedIds.filter((id) => id !== villageId))
      return
    }
    if (selectedIds.length >= MAX_VILLAGES) {
      return
    }
    onChange([...selectedIds, villageId])
  }

  function toggleGroup(group: VillageGroup) {
    const groupIds = group.villages.map((village) => village.id)
    const allSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id))

    if (allSelected) {
      const groupSet = new Set(groupIds)
      onChange(selectedIds.filter((id) => !groupSet.has(id)))
      return
    }

    const next = [...selectedIds]
    const nextSet = new Set(next)
    for (const id of groupIds) {
      if (next.length >= MAX_VILLAGES) {
        break
      }
      if (!nextSet.has(id)) {
        next.push(id)
        nextSet.add(id)
      }
    }
    onChange(next)
  }

  return (
    <fieldset
      disabled={disabled}
      aria-describedby={fieldError ? errorId : undefined}
      className="space-y-2"
    >
      <legend className="text-sm font-medium text-slate-700">
        Villages
        <span aria-hidden="true" className="ml-0.5 text-danger-600">
          *
        </span>
      </legend>
      <p className="text-xs text-slate-500">
        Choose every affected village. Changing the district clears this selection.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Spinner size="sm" label="Loading villages" />
          Loading villages…
        </div>
      ) : error ? (
        <p role="alert" className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No villages are available for this district yet. Ask an administrator to add villages
          and talukas first.
        </p>
      ) : (
        <>
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              Search villages
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <Input
              id={searchId}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by village name or code"
              className="pl-9"
              disabled={disabled}
            />
          </div>

          <p aria-live="polite" className="text-xs font-medium text-slate-600">
            {selectedIds.length} {selectedIds.length === 1 ? 'village' : 'villages'} selected
            {selectedIds.length >= MAX_VILLAGES ? ' (maximum reached)' : ''}
          </p>

          <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {visibleGroups.length === 0 ? (
              <p className="p-3 text-sm text-slate-600">No villages match your search.</p>
            ) : (
              visibleGroups.map((group) => {
                const groupIds = group.villages.map((village) => village.id)
                const allSelected =
                  groupIds.length > 0 && groupIds.every((id) => selected.has(id))
                return (
                  <div key={group.taluka.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <p className="text-sm font-semibold text-navy-900">
                        {group.taluka.name}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({group.villages.length})
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="rounded px-1.5 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={disabled}
                      >
                        {allSelected
                          ? `Clear all in ${group.taluka.name}`
                          : `Select all in ${group.taluka.name}`}
                      </button>
                    </div>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {group.villages.map((village) => {
                        const checked = selected.has(village.id)
                        return (
                          <li key={village.id}>
                            <label
                              className={cn(
                                'flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-sm',
                                checked ? 'bg-blue-50 text-navy-900' : 'text-slate-700',
                                disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleVillage(village.id)}
                                disabled={
                                  disabled ||
                                  (!checked && selectedIds.length >= MAX_VILLAGES)
                                }
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                              />
                              <span>
                                {village.name}
                                <span className="ml-1 text-xs text-slate-500">
                                  {village.code}
                                </span>
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {fieldError ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-700">
          {fieldError}
        </p>
      ) : null}
    </fieldset>
  )
}
