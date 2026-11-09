import { useState, type FormEvent } from 'react'
import { PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { addMutation, getMutations } from '../../api/landRecords'
import type { MutationResponse, MutationType, ParcelResponse } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDate, formatDateTime } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { todayIso } from './dates'
import { MUTATION_TYPE_LABELS } from './labels'

export function MutationsTab({ parcel }: { parcel: ParcelResponse }) {
  const { can } = useAuth()
  const [addOpen, setAddOpen] = useState(false)
  const query = useApiQuery(() => getMutations(parcel.id), [parcel.id])

  const canChange = can(PERMISSION.LAND_RECORD_WRITE) && parcel.status === 'ACTIVE'
  const rows = query.data ?? []

  const columns: TableColumn<MutationResponse>[] = [
    {
      key: 'number',
      header: 'Mutation number',
      render: (mutation) => (
        <span className="font-mono text-xs font-semibold text-navy-900">
          {mutation.mutationNumber}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (mutation) => (
        <span className="whitespace-nowrap">{formatDate(mutation.mutationDate)}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (mutation) => MUTATION_TYPE_LABELS[mutation.mutationType],
    },
    {
      key: 'description',
      header: 'Description',
      render: (mutation) =>
        mutation.description || <span className="text-slate-500">—</span>,
    },
    {
      key: 'createdBy',
      header: 'Recorded by',
      render: (mutation) => (
        <span className="text-xs">{mutation.createdBy ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Recorded at',
      render: (mutation) => (
        <span className="whitespace-nowrap text-xs">
          {formatDateTime(mutation.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Mutation entries"
          description="Mutation records are append-only. A correction is recorded as a new entry; nothing is edited or deleted."
          action={
            canChange ? (
              <Button
                onClick={() => setAddOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Add mutation
              </Button>
            ) : can(PERMISSION.LAND_RECORD_WRITE) ? (
              <Badge variant="warning">Parcel is inactive</Badge>
            ) : null
          }
        />
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title="Could not load mutations"
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(mutation) => mutation.id}
          isLoading={query.isLoading}
          caption="Mutation entries of this parcel"
          emptyTitle="No mutation entries yet"
          emptyDescription={
            canChange
              ? 'Add the first mutation entry for this parcel.'
              : 'Mutation entries will appear here once an officer adds them.'
          }
          emptyAction={
            canChange ? (
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                Add mutation
              </Button>
            ) : undefined
          }
        />
      )}

      {addOpen ? (
        <AddMutationDialog
          parcel={parcel}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            query.reload()
          }}
        />
      ) : null}
    </div>
  )
}

interface AddMutationErrors {
  mutationNumber?: string
  mutationDate?: string
  mutationType?: string
  description?: string
}

function AddMutationDialog({
  parcel,
  onClose,
  onSaved,
}: {
  parcel: ParcelResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<MutationResponse>()
  const [mutationNumber, setMutationNumber] = useState('')
  const [mutationDate, setMutationDate] = useState(todayIso())
  const [mutationType, setMutationType] = useState<MutationType | ''>('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<AddMutationErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: AddMutationErrors = {}
    const number = mutationNumber.trim()

    if (!number) {
      nextErrors.mutationNumber = 'Enter the mutation number.'
    } else if (number.length > 30) {
      nextErrors.mutationNumber = 'Use at most 30 characters.'
    }
    if (!mutationDate) {
      nextErrors.mutationDate = 'Enter the mutation date.'
    } else if (mutationDate > todayIso()) {
      nextErrors.mutationDate = 'The mutation date cannot be in the future.'
    }
    if (!mutationType) {
      nextErrors.mutationType = 'Select the mutation type.'
    }
    if (description.trim().length > 1000) {
      nextErrors.description = 'Use at most 1000 characters.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        addMutation(parcel.id, {
          mutationNumber: number,
          mutationDate,
          mutationType: mutationType as MutationType,
          description: description.trim() || null,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Mutation entry added.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="Add mutation entry"
      description="The backend stores the number in upper case and rejects duplicates for this parcel."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-mutation-form" isLoading={mutation.isLoading}>
            Add mutation
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The mutation was not added" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="add-mutation-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Mutation number"
            required
            maxLength={30}
            value={mutationNumber}
            onChange={(event) => {
              setMutationNumber(event.target.value)
              setErrors((current) => ({ ...current, mutationNumber: undefined }))
            }}
            error={errors.mutationNumber}
          />
          <Input
            label="Mutation date"
            type="date"
            required
            max={todayIso()}
            value={mutationDate}
            onChange={(event) => {
              setMutationDate(event.target.value)
              setErrors((current) => ({ ...current, mutationDate: undefined }))
            }}
            error={errors.mutationDate}
          />
        </div>

        <Select
          label="Mutation type"
          required
          value={mutationType}
          onChange={(event) => {
            setMutationType(event.target.value as MutationType | '')
            setErrors((current) => ({ ...current, mutationType: undefined }))
          }}
          error={errors.mutationType}
        >
          <option value="">Select a mutation type</option>
          {(Object.keys(MUTATION_TYPE_LABELS) as MutationType[]).map((value) => (
            <option key={value} value={value}>
              {MUTATION_TYPE_LABELS[value]}
            </option>
          ))}
        </Select>

        <Textarea
          label="Description"
          value={description}
          maxLength={1000}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
          hint="Optional, up to 1000 characters."
        />
      </form>
    </Modal>
  )
}
