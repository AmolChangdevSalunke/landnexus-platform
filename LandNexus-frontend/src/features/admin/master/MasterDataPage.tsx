import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import {
  isMasterResource,
  listMaster,
  setMasterStatus,
  type MasterRecord,
} from '../../../api/administration'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { DataTable, type TableColumn } from '../../../components/ui/DataTable'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Select } from '../../../components/ui/Select'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { formatDateTime } from '../../../utils/format'
import { PERMISSION } from '../../../utils/permissions'
import { useAuth } from '../../auth/useAuth'
import { NotFoundPage } from '../../shared/NotFoundPage'
import { MasterDataForm } from './MasterDataForm'
import {
  DEPARTMENT_LEVEL_LABELS,
  MASTER_CONFIGS,
  loadMasterParentOptions,
  masterDivisionName,
  masterParentName,
  type MasterResourceConfig,
} from './masterDataConfig'

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; record: MasterRecord }
  | null

export function MasterDataPage() {
  const { resource } = useParams<{ resource: string }>()

  if (!isMasterResource(resource)) {
    return <NotFoundPage />
  }

  const config = MASTER_CONFIGS[resource]
  return <MasterDataScreen key={config.key} config={config} />
}

function MasterDataScreen({ config }: { config: MasterResourceConfig }) {
  const { can } = useAuth()
  const canWrite = can(PERMISSION.MASTER_DATA_WRITE)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [parentFilter, setParentFilter] = useState('')
  const [editor, setEditor] = useState<EditorState>(null)
  const [statusTarget, setStatusTarget] = useState<MasterRecord | null>(null)
  const statusMutation = useApiMutation<MasterRecord>()

  const listQuery = useApiQuery(
    () =>
      listMaster(config.key, {
        page,
        size,
        parentId: parentFilter || undefined,
      }),
    [config.key, page, size, parentFilter],
  )

  const parentOptionsQuery = useApiQuery(
    () =>
      config.parent
        ? loadMasterParentOptions(config.parent.resource)
        : Promise.resolve([]),
    [config.key],
    Boolean(config.parent),
  )

  const rows = listQuery.data?.content ?? []
  const parentOptions = parentOptionsQuery.data ?? []
  const parentOptionsError = parentOptionsQuery.error?.message ?? null
  const parentSelectDisabled =
    !config.parent || parentOptionsQuery.isLoading || parentOptionsQuery.error !== null

  function changeParent(next: string) {
    setParentFilter(next)
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  async function changeStatus() {
    if (!statusTarget) {
      return
    }

    const nextStatus = statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await statusMutation.mutate(() =>
        setMasterStatus(config.key, statusTarget.id, nextStatus),
      )
      setStatusTarget(null)
      listQuery.reload()
    } catch {
      // The mutation hook keeps the error; the dialog stays open.
    }
  }

  const columns: TableColumn<MasterRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (record) => <span className="font-mono text-xs">{record.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (record) => (
        <span className="font-semibold text-navy-900">{record.name}</span>
      ),
    },
  ]

  if (config.parent) {
    columns.push({
      key: 'parent',
      header: config.parent.label,
      render: (record) => {
        const name = masterParentName(record)
        return name ? (
          <span>{name}</span>
        ) : (
          <span className="text-slate-400">Not set</span>
        )
      },
    })
  }

  if (config.hasLevel) {
    columns.push({
      key: 'level',
      header: 'Level',
      render: (record) =>
        'level' in record ? DEPARTMENT_LEVEL_LABELS[record.level] : '—',
    })
  }

  if (config.hasOptionalDivision) {
    columns.push({
      key: 'division',
      header: 'Division',
      render: (record) => masterDivisionName(record) ?? '—',
    })
  }

  columns.push(
    {
      key: 'status',
      header: 'Status',
      render: (record) => (
        <Badge variant={record.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {record.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (record) => (
        <span className="whitespace-nowrap" title={record.updatedAt}>
          {formatDateTime(record.updatedAt)}
        </span>
      ),
    },
  )

  if (canWrite) {
    columns.push({
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (record) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditor({ mode: 'edit', record })}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusTarget(record)}
          >
            {record.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    })
  }

  const hasFilter = Boolean(parentFilter)
  const emptyTitle = hasFilter
    ? `No ${config.title.toLowerCase()} match this filter`
    : `No ${config.title.toLowerCase()} yet`
  const emptyDescription = hasFilter
    ? 'Try another parent record, or clear the filter.'
    : canWrite
      ? `Create the first ${config.singular} with the button above.`
      : `No ${config.title.toLowerCase()} are available to your account.`

  return (
    <>
      <PageHeader
        eyebrow="Administration · Master data"
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button
              variant="outline"
              onClick={listQuery.reload}
              disabled={listQuery.isLoading}
            >
              Refresh
            </Button>
            {canWrite ? (
              <Button onClick={() => setEditor({ mode: 'create' })}>
                New {config.singular}
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          {config.parent ? (
            <Select
              label={config.parent.label}
              value={parentFilter}
              onChange={(event) => changeParent(event.target.value)}
              disabled={parentSelectDisabled}
              hint={
                parentOptionsError
                  ? 'Parent names are not available right now.'
                  : `Filter by ${config.parent.label.toLowerCase()}.`
              }
            >
              <option value="">All {config.parent.label.toLowerCase()}s</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.status !== 'ACTIVE' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
          ) : (
            <div className="hidden sm:block" />
          )}

          <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
            {hasFilter ? (
              <Button
                variant="outline"
                onClick={() => changeParent('')}
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              >
                Clear filter
              </Button>
            ) : null}
            {listQuery.data ? (
              <p className="self-center text-xs text-slate-500">
                {listQuery.data.totalElements}{' '}
                {listQuery.data.totalElements === 1 ? 'record' : 'records'}
                {hasFilter ? ' match your filter' : ' in total'}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {listQuery.error ? (
        <Card>
          <ErrorState
            title={
              listQuery.error.status === 403
                ? 'You do not have access'
                : `Could not load ${config.title.toLowerCase()}`
            }
            message={listQuery.error.message}
            onRetry={listQuery.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(record) => record.id}
          isLoading={listQuery.isLoading}
          caption={`${config.title} master data`}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={
            hasFilter ? (
              <Button variant="outline" onClick={() => changeParent('')}>
                Clear filter
              </Button>
            ) : undefined
          }
          page={listQuery.data?.page ?? page}
          size={listQuery.data?.size ?? size}
          totalElements={listQuery.data?.totalElements ?? 0}
          totalPages={listQuery.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={changeSize}
        />
      )}

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">No delete</Badge>
        Master records are deactivated instead of deleted so references stay valid.
        {canWrite ? null : ' Your role can view this list but not change it.'}
      </p>

      {editor ? (
        <MasterDataForm
          config={config}
          record={editor.mode === 'edit' ? editor.record : undefined}
          parentOptions={parentOptions}
          parentOptionsLoading={parentOptionsQuery.isLoading}
          parentOptionsError={parentOptionsError}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            listQuery.reload()
          }}
        />
      ) : null}

      {statusTarget ? (
        <ConfirmDialog
          title={`${statusTarget.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${
            config.singular
          }?`}
          message={
            <>
              <span className="font-semibold text-navy-900">{statusTarget.name}</span>
              {` (${statusTarget.code}) will be ${
                statusTarget.status === 'ACTIVE' ? 'deactivated' : 'activated'
              }. Existing references are kept; the record is not deleted.`}
              {statusMutation.error ? (
                <span role="alert" className="mt-2 block text-danger-700">
                  {statusMutation.error.message}
                </span>
              ) : null}
            </>
          }
          confirmLabel={statusTarget.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          variant={statusTarget.status === 'ACTIVE' ? 'danger' : 'primary'}
          isLoading={statusMutation.isLoading}
          onConfirm={() => void changeStatus()}
          onClose={() => {
            if (!statusMutation.isLoading) {
              setStatusTarget(null)
            }
          }}
        />
      ) : null}

    </>
  )
}
