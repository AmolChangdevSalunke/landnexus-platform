import { useId, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

export function Tabs({
  items,
  value,
  onChange,
  label = 'Sections',
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  const baseId = useId()
  const active = items.find((item) => item.id === value) ?? items[0]

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1 border-b border-slate-200"
      >
        {items.map((item) => {
          const selected = item.id === active?.id
          return (
            <button
              key={item.id}
              id={`${baseId}-${item.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-${item.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
                  return
                }
                event.preventDefault()
                const index = items.findIndex((entry) => entry.id === item.id)
                const nextIndex =
                  event.key === 'ArrowRight'
                    ? (index + 1) % items.length
                    : (index - 1 + items.length) % items.length
                onChange(items[nextIndex].id)
              }}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {active ? (
        <div
          key={active.id}
          id={`${baseId}-${active.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${active.id}-tab`}
          className="pt-4"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  )
}
