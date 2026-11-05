import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

export interface TableColumn<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  emptyTitle: string
  emptyDescription?: string
  emptyAction?: ReactNode
  caption?: string
  onRowClick?: (row: T) => void
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onSizeChange?: (size: number) => void
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  caption,
  onRowClick,
  page = 0,
  size = 20,
  totalElements = rows.length,
  totalPages,
  onPageChange,
  onSizeChange,
}: DataTableProps<T>) {
  const computedTotalPages = Math.max(1, totalPages ?? Math.ceil(totalElements / size))
  const firstRow = totalElements === 0 ? 0 : page * size + 1
  const lastRow = Math.min((page + 1) * size, totalElements)
  const showPagination = Boolean(onPageChange)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }, (_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-4 py-3 text-slate-700', column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <p aria-live="polite">
            {totalElements === 0
              ? 'No records'
              : `Showing ${firstRow}–${lastRow} of ${totalElements}`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {onSizeChange ? (
              <label className="flex items-center gap-2 text-xs">
                Rows per page
                <select
                  value={size}
                  onChange={(event) => onSizeChange(Number(event.target.value))}
                  className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <span className="text-xs text-slate-500">
              Page {page + 1} of {computedTotalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onPageChange?.(Math.max(0, page - 1))}
                disabled={page <= 0}
                aria-label="Previous page"
                className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange?.(Math.min(computedTotalPages - 1, page + 1))}
                disabled={page + 1 >= computedTotalPages}
                aria-label="Next page"
                className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
