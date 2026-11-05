import { useState, type FormEvent } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { getLoginHistory } from '../../../api/admin'
import type { LoginHistoryResponse } from '../../../api/types'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable, type TableColumn } from '../../../components/ui/DataTable'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { formatDateTime } from '../../../utils/format'

export function LoginHistoryPage() {
  const [draftUsername, setDraftUsername] = useState('')
  const [username, setUsername] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const query = useApiQuery(
    () => getLoginHistory(username || undefined, page, size),
    [username, page, size],
  )

  const rows = query.data?.content ?? []

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUsername(draftUsername.trim())
    setPage(0)
  }

  function clearFilter() {
    setDraftUsername('')
    setUsername('')
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  const columns: TableColumn<LoginHistoryResponse>[] = [
    {
      key: 'occurredAt',
      header: 'Occurred',
      render: (entry) => (
        <span className="whitespace-nowrap" title={entry.occurredAt}>
          {formatDateTime(entry.occurredAt)}
        </span>
      ),
    },
    {
      key: 'username',
      header: 'Username attempted',
      render: (entry) => (
        <span className="font-mono text-xs font-semibold text-navy-900">
          {entry.usernameAttempted}
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (entry) => (
        <Badge variant={entry.success ? 'success' : 'danger'}>
          {entry.success ? 'Success' : 'Failure'}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Failure reason',
      render: (entry) =>
        entry.success ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className="text-danger-700">{entry.failureReason ?? 'Not provided'}</span>
        ),
    },
    {
      key: 'ip',
      header: 'IP address',
      render: (entry) =>
        entry.ipAddress ? (
          <span className="whitespace-nowrap font-mono text-xs">{entry.ipAddress}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'userAgent',
      header: 'User agent',
      render: (entry) =>
        entry.userAgent ? (
          <span
            className="block max-w-64 truncate text-xs text-slate-600"
            title={entry.userAgent}
          >
            {entry.userAgent}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Administration · Audit"
        title="Login history"
        description="Successful and failed sign-in attempts, newest first. Attempts for unknown usernames are recorded too."
        actions={
          <Button
            variant="outline"
            onClick={query.reload}
            disabled={query.isLoading}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <Alert variant="info" title="Strictly read-only" className="mb-4">
        Login attempts cannot be changed or removed from the application. The username filter
        is an exact match applied by the backend.
      </Alert>

      <Card className="mb-4 p-4">
        <form onSubmit={applyFilter} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Username"
            value={draftUsername}
            onChange={(event) => setDraftUsername(event.target.value)}
            placeholder="e.g. consultant.one"
            hint="Exact match, as typed at sign-in."
            containerClassName="sm:max-w-sm sm:flex-1"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" leftIcon={<Search aria-hidden="true" className="h-4 w-4" />}>
              Apply filter
            </Button>
            {username || draftUsername ? (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilter}
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>

        {query.data ? (
          <p className="mt-3 text-xs text-slate-500">
            {query.data.totalElements}{' '}
            {query.data.totalElements === 1 ? 'attempt' : 'attempts'}
            {username ? ` for “${username}”` : ' in total'}
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 403
                ? 'You do not have access'
                : 'Could not load login history'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(entry) => entry.id}
          isLoading={query.isLoading}
          caption="Login attempts, newest first"
          emptyTitle={username ? 'No login attempts match this username' : 'No login attempts yet'}
          emptyDescription={
            username
              ? 'The filter is exact and case-sensitive. Check the spelling and try again.'
              : 'Attempts appear here after the first sign-in is recorded by the backend.'
          }
          emptyAction={
            username ? (
              <Button variant="outline" onClick={clearFilter}>
                Clear filter
              </Button>
            ) : undefined
          }
          page={query.data?.page ?? page}
          size={query.data?.size ?? size}
          totalElements={query.data?.totalElements ?? 0}
          totalPages={query.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={changeSize}
        />
      )}

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">Security trail</Badge>
        A failed attempt may include a reason returned by the authentication layer.
      </p>
    </>
  )
}
