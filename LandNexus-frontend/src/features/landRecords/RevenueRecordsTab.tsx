import { useState, type FormEvent } from 'react'
import { PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { addRevenueRecord, getRevenueRecords } from '../../api/landRecords'
import type {
  ParcelResponse,
  RevenueRecordResponse,
  RevenueRecordType,
} from '../../api/types'
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
import { REVENUE_RECORD_TYPE_LABELS } from './labels'

const RECORD_TYPES = Object.keys(REVENUE_RECORD_TYPE_LABELS) as RevenueRecordType[]

export function RevenueRecordsTab({ parcel }: { parcel: ParcelResponse }) {
  const { can } = useAuth()
  const [addOpen, setAddOpen] = useState(false)
  const query = useApiQuery(() => getRevenueRecords(parcel.id), [parcel.id])

  const canChange = can(PERMISSION.LAND_RECORD_WRITE) && parcel.status === 'ACTIVE'
  const rows = query.data ?? []

  const columns: TableColumn<RevenueRecordResponse>[] = [
    {
      key: 'type',
      header: 'Record type',
      render: (record) => (
        <Badge variant={record.recordType === 'EIGHT_A' ? 'indigo' : 'info'}>
          {REVENUE_RECORD_TYPE_LABELS[record.recordType]}
        </Badge>
      ),
    },
    {
      key: 'extractDate',
      header: 'Extract date',
      render: (record) => (
        <span className="whitespace-nowrap">{formatDate(record.extractDate)}</span>
      ),
    },
    {
      key: 'khata',
      header: 'Khata number',
      render: (record) => record.khataNumber || <span className="text-slate-500">—</span>,
    },
    {
      key: 'particulars',
      header: 'Particulars',
      render: (record) => (
        <p className="max-w-xl whitespace-pre-line text-sm">{record.particulars}</p>
      ),
    },
    {
      key: 'createdBy',
      header: 'Recorded by',
      render: (record) => <span className="text-xs">{record.createdBy ?? '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Recorded at',
      render: (record) => (
        <span className="whitespace-nowrap text-xs">{formatDateTime(record.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="7/12 and 8A extracts"
          description="Revenue extracts are typed in by an officer. Entries are append-only; nothing is edited or deleted."
          action={
            canChange ? (
              <Button
                onClick={() => setAddOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Add revenue record
              </Button>
            ) : can(PERMISSION.LAND_RECORD_WRITE) ? (
              <Badge variant="warning">Parcel is inactive</Badge>
            ) : null
          }
        />
        <Alert variant="info" className="mt-4">
          An 8A extract needs a khata number. The extract date cannot be in the future.
        </Alert>
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title="Could not load revenue records"
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(record) => record.id}
          isLoading={query.isLoading}
          caption="7/12 and 8A revenue records of this parcel"
          emptyTitle="No revenue records yet"
          emptyDescription={
            canChange
              ? 'Record the first 7/12 or 8A extract for this parcel.'
              : 'Revenue extracts will appear here once an officer records them.'
          }
          emptyAction={
            canChange ? (
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                Add revenue record
              </Button>
            ) : undefined
          }
        />
      )}

      {addOpen ? (
        <AddRevenueRecordDialog
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

interface RevenueRecordErrors {
  recordType?: string
  extractDate?: string
  khataNumber?: string
  particulars?: string
}

function AddRevenueRecordDialog({
  parcel,
  onClose,
  onSaved,
}: {
  parcel: ParcelResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<RevenueRecordResponse>()
  const [recordType, setRecordType] = useState<RevenueRecordType | ''>('')
  const [extractDate, setExtractDate] = useState(todayIso())
  const [khataNumber, setKhataNumber] = useState('')
  const [particulars, setParticulars] = useState('')
  const [errors, setErrors] = useState<RevenueRecordErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: RevenueRecordErrors = {}
    const khata = khataNumber.trim()

    if (!recordType) {
      nextErrors.recordType = 'Select the record type.'
    }
    if (!extractDate) {
      nextErrors.extractDate = 'Enter the extract date.'
    } else if (extractDate > todayIso()) {
      nextErrors.extractDate = 'The extract date cannot be in the future.'
    }
    if (recordType === 'EIGHT_A' && !khata) {
      nextErrors.khataNumber = 'An 8A extract needs a khata number.'
    } else if (khata.length > 30) {
      nextErrors.khataNumber = 'Use at most 30 characters.'
    }
    if (!particulars.trim()) {
      nextErrors.particulars = 'Enter the extract particulars.'
    } else if (particulars.trim().length > 2000) {
      nextErrors.particulars = 'Use at most 2000 characters.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        addRevenueRecord(parcel.id, {
          recordType: recordType as RevenueRecordType,
          extractDate,
          khataNumber: khata || null,
          particulars: particulars.trim(),
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Revenue record added.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message; the form stays filled in.
    }
  }

  return (
    <Modal
      title="Add revenue record"
      description="Copy the extract exactly as it appears in the revenue record. The text is not read by OCR."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-revenue-record-form" isLoading={mutation.isLoading}>
            Add record
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The revenue record was not added" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="add-revenue-record-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Record type"
            required
            value={recordType}
            onChange={(event) => {
              setRecordType(event.target.value as RevenueRecordType | '')
              setErrors((current) => ({ ...current, recordType: undefined }))
            }}
            error={errors.recordType}
          >
            <option value="">Select a record type</option>
            {RECORD_TYPES.map((value) => (
              <option key={value} value={value}>
                {REVENUE_RECORD_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>

          <Input
            label="Extract date"
            type="date"
            required
            max={todayIso()}
            value={extractDate}
            onChange={(event) => {
              setExtractDate(event.target.value)
              setErrors((current) => ({ ...current, extractDate: undefined }))
            }}
            error={errors.extractDate}
          />
        </div>

        <Input
          label="Khata number"
          maxLength={30}
          value={khataNumber}
          onChange={(event) => {
            setKhataNumber(event.target.value)
            setErrors((current) => ({ ...current, khataNumber: undefined }))
          }}
          error={errors.khataNumber}
          hint={
            recordType === 'EIGHT_A'
              ? 'Mandatory for an 8A extract.'
              : 'Optional for a 7/12 extract.'
          }
        />

        <Textarea
          label="Particulars"
          required
          value={particulars}
          maxLength={2000}
          rows={6}
          onChange={(event) => {
            setParticulars(event.target.value)
            setErrors((current) => ({ ...current, particulars: undefined }))
          }}
          error={errors.particulars}
          hint={`${particulars.length}/2000 characters`}
        />
      </form>
    </Modal>
  )
}
