import { ArrowDown, ArrowUp, PlusCircle, Trash2 } from 'lucide-react'
import type { ComponentRequest, ComponentType } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { MultiSelect } from '../../components/ui/MultiSelect'
import { Select } from '../../components/ui/Select'
import { COMPONENT_TYPE_LABELS } from './labels'

export interface ComponentDraft {
  code: string
  name: string
  type: ComponentType
  /** Kept as text so the builder never pre-fills a number. */
  factor: string
  baseCodes: string[]
}

export const EMPTY_COMPONENT: ComponentDraft = {
  code: '',
  name: '',
  type: 'LAND_VALUE',
  factor: '',
  baseCodes: [],
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/

/**
 * Mirrors the server's component rules so the user sees the problem before a
 * round trip. The server remains the authority and its 400 text is shown too.
 */
export function validateComponentDrafts(drafts: ComponentDraft[]): string[] {
  const errors: string[] = []
  if (drafts.length === 0) {
    return ['Add at least one component.']
  }

  const earlier = new Set<string>()
  let landValueCount = 0
  let assetValueCount = 0

  drafts.forEach((draft, index) => {
    const label = draft.code.trim() || `Component ${index + 1}`

    if (!CODE_PATTERN.test(draft.code.trim())) {
      errors.push(
        `${label}: the code must start with a letter and contain only capital letters, digits and underscores (2–40 characters).`,
      )
    }
    if (earlier.has(draft.code.trim())) {
      errors.push(`${label}: the code is used more than once.`)
    }
    if (!draft.name.trim()) {
      errors.push(`${label}: enter a name.`)
    }

    if (draft.type === 'LAND_VALUE') {
      landValueCount += 1
      const factor = Number(draft.factor)
      if (!draft.factor.trim() || !Number.isFinite(factor) || factor <= 0 || factor > 10) {
        errors.push(`${label}: the multiplier must be above 0 and at most 10.`)
      }
    }

    if (draft.type === 'ASSET_VALUE') {
      assetValueCount += 1
    }

    if (draft.type === 'PERCENT_OF') {
      const factor = Number(draft.factor)
      if (!draft.factor.trim() || !Number.isFinite(factor) || factor < 0 || factor > 500) {
        errors.push(`${label}: the percentage must be between 0 and 500.`)
      }
      if (draft.baseCodes.length === 0) {
        errors.push(`${label}: select at least one earlier component.`)
      }
      draft.baseCodes.forEach((base) => {
        if (!earlier.has(base)) {
          errors.push(`${label}: ${base} must be an earlier component.`)
        }
      })
    }

    if (draft.type === 'FIXED_PER_HECTARE') {
      const factor = Number(draft.factor)
      if (!draft.factor.trim() || !Number.isFinite(factor) || factor < 0 || factor > 1_000_000_000) {
        errors.push(`${label}: the amount per hectare is out of range.`)
      }
    }

    earlier.add(draft.code.trim())
  })

  if (landValueCount !== 1) {
    errors.push('A rule set needs exactly one LAND_VALUE component.')
  }
  if (assetValueCount > 1) {
    errors.push('A rule set can have at most one ASSET_VALUE component.')
  }

  return errors
}

export function draftsToRequests(drafts: ComponentDraft[]): ComponentRequest[] {
  return drafts.map((draft) => ({
    code: draft.code.trim(),
    name: draft.name.trim(),
    type: draft.type,
    factor:
      draft.type === 'ASSET_VALUE'
        ? null
        : draft.factor.trim()
          ? Number(draft.factor)
          : null,
    baseCodes: draft.type === 'PERCENT_OF' ? draft.baseCodes : null,
  }))
}

export function ComponentBuilder({
  value,
  onChange,
  disabled = false,
  errors = [],
}: {
  value: ComponentDraft[]
  onChange: (next: ComponentDraft[]) => void
  disabled?: boolean
  errors?: string[]
}) {
  function update(index: number, patch: Partial<ComponentDraft>) {
    onChange(
      value.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    )
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= value.length) {
      return
    }
    const next = [...value]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onChange(next)
  }

  function remove(index: number) {
    onChange(value.filter((_, draftIndex) => draftIndex !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy-900">Components</p>
          <p className="text-xs text-slate-500">
            The order matters: a percentage can only refer to components above it.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...value, { ...EMPTY_COMPONENT }])}
          leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
        >
          Add component
        </Button>
      </div>

      {errors.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700"
        >
          <p className="font-semibold">Check the component list</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          No components yet. Add exactly one land value component first.
        </p>
      ) : (
        <ol className="space-y-3">
          {value.map((draft, index) => {
            const earlierOptions = value.slice(0, index).map((earlier) => ({
              value: earlier.code.trim(),
              label: earlier.code.trim() || `Component ${value.indexOf(earlier) + 1}`,
              disabled: !earlier.code.trim(),
            }))

            return (
              <li
                key={index}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Component {index + 1}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move component ${index + 1} up`}
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || index === value.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move component ${index + 1} down`}
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => remove(index)}
                      aria-label={`Remove component ${index + 1}`}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Code"
                    required
                    value={draft.code}
                    maxLength={40}
                    disabled={disabled}
                    placeholder="LAND_BASE"
                    onChange={(event) =>
                      update(index, { code: event.target.value.toUpperCase() })
                    }
                    hint="Capital letters, digits and underscores."
                  />
                  <Input
                    label="Name"
                    required
                    value={draft.name}
                    maxLength={120}
                    disabled={disabled}
                    onChange={(event) => update(index, { name: event.target.value })}
                  />
                  <Select
                    label="Type"
                    required
                    value={draft.type}
                    disabled={disabled}
                    onChange={(event) => {
                      const type = event.target.value as ComponentType
                      update(index, {
                        type,
                        factor: type === 'ASSET_VALUE' ? '' : draft.factor,
                        baseCodes: type === 'PERCENT_OF' ? draft.baseCodes : [],
                      })
                    }}
                  >
                    {Object.entries(COMPONENT_TYPE_LABELS).map(([type, label]) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                  </Select>

                  {draft.type === 'ASSET_VALUE' ? (
                    <div className="self-end rounded-lg bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
                      The asset total is inserted by the server; no factor is needed.
                    </div>
                  ) : (
                    <Input
                      label={
                        draft.type === 'PERCENT_OF'
                          ? 'Percentage (0–500)'
                          : draft.type === 'FIXED_PER_HECTARE'
                            ? 'Amount per hectare (INR)'
                            : 'Multiplier (above 0, at most 10)'
                      }
                      required
                      inputMode="decimal"
                      value={draft.factor}
                      disabled={disabled}
                      onChange={(event) => update(index, { factor: event.target.value })}
                      hint="Leave blank until you enter the value from the law or notification."
                    />
                  )}
                </div>

                {draft.type === 'PERCENT_OF' ? (
                  <div className="mt-3">
                    <MultiSelect
                      label="Earlier components"
                      options={earlierOptions}
                      value={draft.baseCodes}
                      disabled={disabled}
                      onChange={(baseCodes) => update(index, { baseCodes })}
                      hint="Only components above this row can be selected."
                      emptyText="Add a component above this row first."
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
