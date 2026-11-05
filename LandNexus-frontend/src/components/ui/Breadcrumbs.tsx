import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export type BreadcrumbTone = 'light' | 'dark'

export function Breadcrumbs({
  items,
  tone = 'light',
}: {
  items: BreadcrumbItem[]
  tone?: BreadcrumbTone
}) {
  const dark = tone === 'dark'

  return (
    <nav aria-label="Breadcrumb">
      <ol
        className={cn(
          'flex flex-wrap items-center gap-1 text-xs sm:text-sm',
          dark ? 'text-slate-300' : 'text-slate-500',
        )}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className={cn('h-3.5 w-3.5', dark ? 'text-slate-500' : 'text-slate-400')}
                />
              ) : null}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className={cn(
                    'rounded px-1 py-0.5 hover:no-underline',
                    dark ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-slate-100',
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    isLast ? 'font-semibold' : 'px-1',
                    isLast && (dark ? 'text-white' : 'text-navy-900'),
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
