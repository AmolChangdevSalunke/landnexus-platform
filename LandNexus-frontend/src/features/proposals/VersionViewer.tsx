import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import type { ProposalVersion } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { formatDateTime } from '../../utils/format'
import { cn } from '../../utils/cn'

interface SnapshotLine {
  key: string
  value: string
}

type DiffKind = 'same' | 'added' | 'changed' | 'removed'

interface DiffLine extends SnapshotLine {
  kind: DiffKind
}

function parseSnapshot(snapshot: string): SnapshotLine[] {
  return snapshot
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.indexOf('=')
      if (separator === -1) {
        return { key: line, value: '' }
      }
      return { key: line.slice(0, separator), value: line.slice(separator + 1) }
    })
}

/**
 * A line-by-line comparison against the previous version. It is intentionally
 * simple: the backend stores a readable key=value snapshot, so a small diff is
 * enough and no extra parsing library is needed.
 */
function diffSnapshot(current: SnapshotLine[], previous: SnapshotLine[] | null): DiffLine[] {
  if (!previous) {
    return current.map((line) => ({ ...line, kind: 'same' }))
  }

  const previousByKey = new Map(previous.map((line) => [line.key, line.value]))
  const currentKeys = new Set(current.map((line) => line.key))

  const rows: DiffLine[] = current.map((line) => {
    if (!previousByKey.has(line.key)) {
      return { ...line, kind: 'added' }
    }
    return {
      ...line,
      kind: previousByKey.get(line.key) === line.value ? 'same' : 'changed',
    }
  })

  for (const line of previous) {
    if (!currentKeys.has(line.key)) {
      rows.push({ ...line, kind: 'removed' })
    }
  }

  return rows
}

const DIFF_STYLES: Record<DiffKind, { row: string; marker: string; label: string }> = {
  same: { row: 'text-slate-700', marker: ' ', label: 'Unchanged' },
  added: {
    row: 'bg-success-50 text-success-700',
    marker: '+',
    label: 'Added',
  },
  changed: {
    row: 'bg-warning-50 text-warning-700',
    marker: '±',
    label: 'Changed',
  },
  removed: {
    row: 'bg-danger-50 text-danger-700 line-through',
    marker: '−',
    label: 'Removed',
  },
}

export function VersionViewer({ versions }: { versions: ProposalVersion[] }) {
  const [selectedVersionNo, setSelectedVersionNo] = useState<number | null>(null)

  const ordered = useMemo(
    () => [...versions].sort((left, right) => left.versionNo - right.versionNo),
    [versions],
  )

  const selectedIndex = ordered.findIndex(
    (version) => version.versionNo === selectedVersionNo,
  )
  const selected = selectedIndex >= 0 ? ordered[selectedIndex] : null
  const previous = selectedIndex > 0 ? ordered[selectedIndex - 1] : null

  const diff = useMemo(() => {
    if (!selected) {
      return []
    }
    return diffSnapshot(
      parseSnapshot(selected.snapshot),
      previous ? parseSnapshot(previous.snapshot) : null,
    )
  }, [selected, previous])

  if (versions.length === 0) {
    return (
      <EmptyState
        title="No versions yet"
        description="A frozen snapshot is saved each time the proposal is submitted or resubmitted."
      />
    )
  }

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {[...ordered].reverse().map((version) => (
          <li
            key={version.versionNo}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-navy-900">
                Version {version.versionNo}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {version.createdByUsername} · {formatDateTime(version.createdAt)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Eye aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setSelectedVersionNo(version.versionNo)}
            >
              View snapshot
            </Button>
          </li>
        ))}
      </ul>

      {selected ? (
        <Modal
          title={`Version ${selected.versionNo} snapshot`}
          description={`Saved by ${selected.createdByUsername} on ${formatDateTime(
            selected.createdAt,
          )}. ${
            previous
              ? `Compared with version ${previous.versionNo}.`
              : 'This is the first saved version.'
          }`}
          onClose={() => setSelectedVersionNo(null)}
          size="lg"
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              The snapshot is the frozen proposal text stored by the backend. Values are shown
              exactly as saved; identifiers are not translated.
            </p>

            <ul aria-label={`Snapshot changes for version ${selected.versionNo}`} className="space-y-1">
              {diff.map((line) => {
                const styles = DIFF_STYLES[line.kind]
                return (
                  <li
                    key={`${line.kind}-${line.key}`}
                    className={cn(
                      'flex items-start gap-2 rounded-md px-2 py-1 text-xs',
                      styles.row,
                    )}
                  >
                    <span aria-hidden="true" className="w-3 shrink-0 font-mono font-bold">
                      {styles.marker}
                    </span>
                    <span className="sr-only">{styles.label}: </span>
                    <span className="w-40 shrink-0 break-words font-mono font-semibold">
                      {line.key}
                    </span>
                    <span aria-hidden="true" className="shrink-0 font-mono">
                      =
                    </span>
                    <span className="min-w-0 break-all font-mono">
                      {line.value || '—'}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              <span>
                <span aria-hidden="true" className="mr-1 font-mono font-bold text-success-700">
                  +
                </span>
                Added
              </span>
              <span>
                <span aria-hidden="true" className="mr-1 font-mono font-bold text-warning-700">
                  ±
                </span>
                Changed
              </span>
              <span>
                <span aria-hidden="true" className="mr-1 font-mono font-bold text-danger-700">
                  −
                </span>
                Removed
              </span>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
