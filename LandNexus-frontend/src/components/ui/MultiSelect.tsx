import { useId } from 'react'
import { cn } from '../../utils/cn'

export interface MultiSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface MultiSelectProps {
  label: string
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  hint?: string
  error?: string
  disabled?: boolean
  emptyText?: string
}

/**
 * An accessible multi-select built from native checkboxes. A native select
 * with `multiple` is hard to use with a keyboard and screen reader, so the
 * selected values are mirrored as removable chips.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  hint,
  error,
  disabled = false,
  emptyText = 'No options available.',
}: MultiSelectProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((entry) => entry !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const selectedOptions = options.filter((option) => value.includes(option.value))

  return (
    <div className="space-y-1.5">
      <p className="block text-sm font-medium text-slate-700">{label}</p>

      {selectedOptions.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label}: selected`}>
          {selectedOptions.map((option) => (
            <li
              key={option.value}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200"
            >
              {option.label}
              <button
                type="button"
                onClick={() => toggle(option.value)}
                disabled={disabled}
                aria-label={`Remove ${option.label}`}
                className="rounded-full px-0.5 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'max-h-44 overflow-y-auto rounded-lg border bg-white p-2',
          error ? 'border-danger-600' : 'border-slate-300',
        )}
      >
        <legend className="sr-only">{label}</legend>
        {options.length === 0 ? (
          <p className="px-1 py-1 text-xs text-slate-500">{emptyText}</p>
        ) : (
          <ul className="space-y-1">
            {options.map((option) => {
              const optionId = `${id}-${option.value}`
              return (
                <li key={option.value}>
                  <label
                    htmlFor={optionId}
                    className={cn(
                      'flex items-center gap-2 rounded px-1.5 py-1 text-sm',
                      option.disabled || disabled
                        ? 'cursor-not-allowed text-slate-400'
                        : 'cursor-pointer text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <input
                      id={optionId}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={value.includes(option.value)}
                      disabled={option.disabled || disabled}
                      onChange={() => toggle(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>

      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
