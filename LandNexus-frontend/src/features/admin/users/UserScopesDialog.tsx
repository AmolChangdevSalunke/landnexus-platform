import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import { getUserScopes, replaceUserScopes } from '../../../api/admin'
import { listMaster } from '../../../api/administration'
import { readAllPages } from '../../../api/pagination'
import type {
  MasterBase,
  RoleResponse,
  ScopeEntryRequest,
  ScopeEntryResponse,
  ScopeType,
  UserResponse,
  UserScopesRequest,
} from '../../../api/types'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Modal } from '../../../components/ui/Modal'
import { Select } from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Spinner'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { useApiQuery } from '../../../hooks/useApiQuery'

/** Roles that already cover the whole country; assignments are not used for them. */
const NATIONAL_ROLES = ['SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'AUDITOR']

const SCOPE_TYPE_LABELS: Record<ScopeType, string> = {
  STATE: 'State',
  DIVISION: 'Division',
  DISTRICT: 'District',
}

interface UserScopesDialogProps {
  user: UserResponse
  roles: RoleResponse[]
  canReadMaster: boolean
  onClose: () => void
  onSaved: () => void
}

function scopeKey(entry: Pick<ScopeEntryResponse, 'type' | 'referenceId'>): string {
  return `${entry.type}:${entry.referenceId}`
}

function toRequestEntry(entry: ScopeEntryResponse): ScopeEntryRequest {
  switch (entry.type) {
    case 'STATE':
      return { stateId: entry.referenceId }
    case 'DIVISION':
      return { divisionId: entry.referenceId }
    case 'DISTRICT':
      return { districtId: entry.referenceId }
  }
}

function emptyRequest(entries: ScopeEntryResponse[]): UserScopesRequest {
  return { scopes: entries.map(toRequestEntry) }
}

export function UserScopesDialog({
  user,
  roles,
  canReadMaster,
  onClose,
  onSaved,
}: UserScopesDialogProps) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<ScopeEntryResponse[]>()
  const scopesQuery = useApiQuery(() => getUserScopes(user.id), [user.id])

  const [entries, setEntries] = useState<ScopeEntryResponse[]>([])
  const [scopeType, setScopeType] = useState<ScopeType>('STATE')
  const [referenceId, setReferenceId] = useState('')

  const statesQuery = useApiQuery(
    () => readAllPages((page) => listMaster('states', { page, size: 100 })),
    [canReadMaster],
    canReadMaster && scopeType === 'STATE',
  )
  const divisionsQuery = useApiQuery(
    () => readAllPages((page) => listMaster('divisions', { page, size: 100 })),
    [canReadMaster],
    canReadMaster && scopeType === 'DIVISION',
  )
  const districtsQuery = useApiQuery(
    () => readAllPages((page) => listMaster('districts', { page, size: 100 })),
    [canReadMaster],
    canReadMaster && scopeType === 'DISTRICT',
  )

  useEffect(() => {
    if (scopesQuery.data) {
      setEntries(scopesQuery.data)
    }
  }, [scopesQuery.data])

  const nationalRole = NATIONAL_ROLES.find((code) => user.roles.includes(code))
  const roleName = (code: string) => roles.find((role) => role.code === code)?.name ?? code

  const referenceQuery =
    scopeType === 'STATE'
      ? statesQuery
      : scopeType === 'DIVISION'
        ? divisionsQuery
        : districtsQuery

  const referenceOptions: MasterBase[] =
    scopeType === 'STATE'
      ? (statesQuery.data ?? [])
      : scopeType === 'DIVISION'
        ? (divisionsQuery.data ?? [])
        : (districtsQuery.data ?? [])

  const assignedKeys = new Set(entries.map(scopeKey))
  const availableOptions = referenceOptions.filter(
    (option) => option.status === 'ACTIVE' && !assignedKeys.has(`${scopeType}:${option.id}`),
  )

  function changeType(next: ScopeType) {
    setScopeType(next)
    setReferenceId('')
  }

  function addScope() {
    if (!referenceId) {
      return
    }
    const option = referenceOptions.find((candidate) => candidate.id === referenceId)
    if (!option) {
      return
    }
    const key = `${scopeType}:${option.id}`
    if (assignedKeys.has(key)) {
      return
    }
    setEntries((current) => [
      ...current,
      {
        id: key,
        type: scopeType,
        referenceId: option.id,
        referenceName: option.name,
      },
    ])
    setReferenceId('')
  }

  function removeScope(key: string) {
    setEntries((current) => current.filter((entry) => scopeKey(entry) !== key))
  }

  async function handleSave() {
    if (mutation.isLoading) {
      return
    }
    try {
      await mutation.mutate(() => replaceUserScopes(user.id, emptyRequest(entries)))
      dispatch(
        addToast({
          variant: 'success',
          message: `Geographic scope updated for ${user.username}.`,
        }),
      )
      onSaved()
    } catch {
      // The mutation hook keeps the error; the dialog stays open.
    }
  }

  const loading = scopesQuery.isLoading
  const error = scopesQuery.error

  return (
    <Modal
      title={`Geographic scope · ${user.username}`}
      description="Saving replaces the complete scope list. An empty list removes every assignment."
      size="lg"
      onClose={() => {
        if (!mutation.isLoading) {
          onClose()
        }
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            isLoading={mutation.isLoading}
            disabled={loading || error !== null}
          >
            Save scope
          </Button>
        </>
      }
    >
      {nationalRole ? (
        <Alert variant="info" title="Nation-wide role" className="mb-4">
          {user.username} has the {roleName(nationalRole)} role ({nationalRole}), which already
          covers every district. Assignments are stored but do not restrict this account.
        </Alert>
      ) : null}

      {mutation.error ? (
        <Alert variant="error" title="Scope was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
          <Spinner size="sm" label="Loading scope" />
          Loading the current scope…
        </div>
      ) : error ? (
        <ErrorState
          title={error.status === 403 ? 'You do not have access' : 'Could not load the scope'}
          message={error.message}
          onRetry={scopesQuery.reload}
        />
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="current-scope-heading">
            <h3
              id="current-scope-heading"
              className="text-sm font-semibold text-navy-900"
            >
              Current assignments
            </h3>
            {entries.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">
                No geographic scope is assigned. This account sees only what its roles allow.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {entries.map((entry) => {
                  const key = scopeKey(entry)
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {SCOPE_TYPE_LABELS[entry.type]}
                        </span>
                        <span className="truncate font-medium text-navy-900">
                          {entry.referenceName}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeScope(key)}
                        disabled={mutation.isLoading}
                        leftIcon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                        aria-label={`Remove ${SCOPE_TYPE_LABELS[entry.type]} ${entry.referenceName}`}
                      >
                        Remove
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="add-scope-heading" className="space-y-3">
            <h3 id="add-scope-heading" className="text-sm font-semibold text-navy-900">
              Add an assignment
            </h3>

            {canReadMaster ? (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-end">
                  <Select
                    label="Type"
                    value={scopeType}
                    onChange={(event) => changeType(event.target.value as ScopeType)}
                    disabled={mutation.isLoading}
                  >
                    {(Object.keys(SCOPE_TYPE_LABELS) as ScopeType[]).map((type) => (
                      <option key={type} value={type}>
                        {SCOPE_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label={SCOPE_TYPE_LABELS[scopeType]}
                    value={referenceId}
                    onChange={(event) => setReferenceId(event.target.value)}
                    disabled={referenceQuery.isLoading || referenceQuery.error !== null}
                    hint={
                      referenceQuery.error
                        ? referenceQuery.error.message
                        : referenceQuery.isLoading
                          ? 'Loading reference records…'
                          : availableOptions.length === 0
                            ? 'Every active record of this type is already assigned.'
                            : 'Only active records are listed.'
                    }
                  >
                    <option value="">Select a {SCOPE_TYPE_LABELS[scopeType].toLowerCase()}</option>
                    {availableOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>

                  <Button
                    variant="outline"
                    onClick={addScope}
                    disabled={!referenceId || mutation.isLoading}
                    leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Candidate lists come from master data, so this section needs
                  MASTER_DATA_READ as well as USER_WRITE.
                </p>
              </>
            ) : (
              <Alert variant="warning" title="Candidate lists unavailable">
                Your account can read this scope but cannot read master data, so new state,
                division or district assignments cannot be selected here. You can still remove
                existing assignments and save.
              </Alert>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
