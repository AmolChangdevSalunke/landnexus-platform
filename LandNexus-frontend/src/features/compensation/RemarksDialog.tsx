import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Textarea'
import { Alert } from '../../components/ui/Alert'
import type { ApiErrorInfo } from '../../api/errors'

/**
 * A small dialog for an approval or rejection that may need remarks.
 * The backend still enforces who may decide and whether remarks are required.
 */
export function RemarksDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  requireRemarks = false,
  isLoading,
  error,
  onConfirm,
  onClose,
}: {
  title: string
  description?: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'danger'
  requireRemarks?: boolean
  isLoading: boolean
  error: ApiErrorInfo | null
  onConfirm: (remarks: string) => void
  onClose: () => void
}) {
  const [remarks, setRemarks] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) {
      return
    }
    const trimmed = remarks.trim()
    if (requireRemarks && !trimmed) {
      setLocalError('Remarks are required for this decision.')
      return
    }
    setLocalError(null)
    onConfirm(trimmed)
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="remarks-dialog-form"
            variant={confirmVariant}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <Alert variant="error" title="The decision was not recorded" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <form id="remarks-dialog-form" onSubmit={submit} noValidate className="space-y-4">
        <Textarea
          label={requireRemarks ? 'Remarks (required)' : 'Remarks (optional)'}
          value={remarks}
          onChange={(event) => {
            setRemarks(event.target.value)
            setLocalError(null)
          }}
          error={localError ?? undefined}
          rows={4}
          maxLength={1000}
          hint="The remarks are stored with the decision in the audit trail."
        />
      </form>
    </Modal>
  )
}
