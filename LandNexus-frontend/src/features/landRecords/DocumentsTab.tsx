import { useState, type FormEvent } from 'react'
import { Download, FileUp, PlusCircle, ShieldCheck, XCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  downloadDocumentVersion,
  getParcelDocuments,
  rejectDocument,
  uploadDocumentVersion,
  uploadParcelDocument,
  verifyDocument,
} from '../../api/landRecords'
import type {
  DocumentCategory,
  DocumentResponse,
  DocumentVersion,
  ParcelResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { saveBlob } from '../../utils/download'
import { formatDateTime } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import {
  DOCUMENT_CATEGORY_LABELS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_VARIANTS,
  formatFileSize,
  validateDocumentFile,
} from './labels'

const CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

export function DocumentsTab({ parcel }: { parcel: ParcelResponse }) {
  const { can, user } = useAuth()
  const dispatch = useAppDispatch()
  const query = useApiQuery(() => getParcelDocuments(parcel.id), [parcel.id])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [versionTarget, setVersionTarget] = useState<DocumentResponse | null>(null)
  const [decision, setDecision] = useState<{
    document: DocumentResponse
    outcome: 'VERIFIED' | 'REJECTED'
  } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const canUpload = can(PERMISSION.DOCUMENT_UPLOAD) && parcel.status === 'ACTIVE'
  const canVerify = can(PERMISSION.DOCUMENT_VERIFY)
  const rows = query.data ?? []

  async function download(document: DocumentResponse, version: DocumentVersion) {
    const key = `${document.id}:${version.versionNo}`
    setDownloading(key)
    try {
      const file = await downloadDocumentVersion(
        document.id,
        version.versionNo,
        version.originalFilename,
      )
      saveBlob(file.blob, file.filename || version.originalFilename)
    } catch {
      dispatch(
        addToast({
          variant: 'error',
          title: 'Download failed',
          message: 'The file could not be downloaded. Please try again.',
        }),
      )
    } finally {
      setDownloading(null)
    }
  }

  function currentVersion(document: DocumentResponse): DocumentVersion | null {
    return (
      document.versions.find((version) => version.versionNo === document.currentVersionNo) ??
      document.versions[document.versions.length - 1] ??
      null
    )
  }

  function canDecide(document: DocumentResponse): boolean {
    if (!canVerify || document.verificationStatus !== 'PENDING') {
      return false
    }
    const current = currentVersion(document)
    return current?.uploadedByUsername !== user?.username
  }

  function uploadedByMe(document: DocumentResponse): boolean {
    return currentVersion(document)?.uploadedByUsername === user?.username
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Supporting documents"
          description="PDF, JPEG or PNG up to 10 MB. A new version resets verification to pending. Downloads go through your authenticated session."
          action={
            canUpload ? (
              <Button
                onClick={() => setUploadOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                Upload document
              </Button>
            ) : can(PERMISSION.DOCUMENT_UPLOAD) ? (
              <Badge variant="warning">Parcel is inactive</Badge>
            ) : null
          }
        />
        <Alert variant="info" className="mt-4">
          The backend checks the real file content, not only the extension. The officer who
          uploaded the current version cannot verify or reject it.
        </Alert>
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={
              query.error.status === 404
                ? 'Documents are not available'
                : 'Could not load documents'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : query.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No documents yet"
            description={
              canUpload
                ? 'Upload the first supporting document for this parcel.'
                : 'Supporting documents will appear here once an officer uploads them.'
            }
            action={
              canUpload ? (
                <Button variant="outline" onClick={() => setUploadOpen(true)}>
                  Upload document
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((document) => {
            const current = currentVersion(document)
            return (
              <Card key={document.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-navy-900">{document.title}</h3>
                      <Badge variant="neutral">
                        {DOCUMENT_CATEGORY_LABELS[document.category]}
                      </Badge>
                      <Badge variant={VERIFICATION_STATUS_VARIANTS[document.verificationStatus]}>
                        {VERIFICATION_STATUS_LABELS[document.verificationStatus]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Version {document.currentVersionNo}
                      {current
                        ? ` · ${current.originalFilename} · ${formatFileSize(current.sizeBytes)}`
                        : ''}
                      {current ? ` · uploaded by ${current.uploadedByUsername}` : ''}
                    </p>
                    {current ? (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-600">SHA-256</span>
                        <code
                          title={current.sha256}
                          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                        >
                          {shortSha256(current.sha256)}
                        </code>
                        <CopyButton value={current.sha256} label="SHA-256 checksum" />
                      </p>
                    ) : null}
                    {document.verifiedAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Last decision {formatDateTime(document.verifiedAt)}
                        {document.verificationRemarks
                          ? ` · ${document.verificationRemarks}`
                          : ''}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {current ? (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={downloading === `${document.id}:${current.versionNo}`}
                        onClick={() => void download(document, current)}
                        leftIcon={<Download aria-hidden="true" className="h-3.5 w-3.5" />}
                      >
                        Download
                      </Button>
                    ) : null}
                    {canUpload ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVersionTarget(document)}
                        leftIcon={<FileUp aria-hidden="true" className="h-3.5 w-3.5" />}
                      >
                        New version
                      </Button>
                    ) : null}
                    {canDecide(document) ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDecision({ document, outcome: 'VERIFIED' })}
                          leftIcon={<ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />}
                        >
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDecision({ document, outcome: 'REJECTED' })}
                          leftIcon={<XCircle aria-hidden="true" className="h-3.5 w-3.5" />}
                        >
                          Reject
                        </Button>
                      </>
                    ) : uploadedByMe(document) && document.verificationStatus === 'PENDING' ? (
                      <span className="self-center text-xs text-slate-500">
                        You uploaded this version; another officer must verify it.
                      </span>
                    ) : null}
                  </div>
                </div>

                {document.versions.length > 0 ? (
                  <details className="mt-3 border-t border-slate-100 pt-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Version history ({document.versions.length})
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {document.versions
                        .slice()
                        .sort((a, b) => b.versionNo - a.versionNo)
                        .map((version) => (
                          <li
                            key={version.versionNo}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                          >
                            <div className="min-w-0 text-xs text-slate-600">
                              <p className="font-semibold text-slate-800">
                                v{version.versionNo} · {version.originalFilename}
                              </p>
                              <p>
                                {version.contentType} · {formatFileSize(version.sizeBytes)} ·{' '}
                                {version.uploadedByUsername} ·{' '}
                                {formatDateTime(version.uploadedAt)}
                              </p>
                              <p className="break-all font-mono text-[10px] text-slate-500">
                                SHA-256 {version.sha256}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              isLoading={downloading === `${document.id}:${version.versionNo}`}
                              onClick={() => void download(document, version)}
                            >
                              Download v{version.versionNo}
                            </Button>
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      {uploadOpen ? (
        <UploadDocumentDialog
          parcel={parcel}
          onClose={() => setUploadOpen(false)}
          onSaved={() => {
            setUploadOpen(false)
            query.reload()
          }}
        />
      ) : null}

      {versionTarget ? (
        <UploadVersionDialog
          document={versionTarget}
          onClose={() => setVersionTarget(null)}
          onSaved={() => {
            setVersionTarget(null)
            query.reload()
          }}
        />
      ) : null}

      {decision ? (
        <DocumentDecisionDialog
          document={decision.document}
          outcome={decision.outcome}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null)
            query.reload()
          }}
        />
      ) : null}
    </div>
  )
}

function shortSha256(value: string): string {
  if (value.length <= 24) {
    return value
  }
  return `${value.slice(0, 16)}…${value.slice(-8)}`
}

function FileField({
  file,
  error,
  onChange,
  label,
}: {
  file: File | null
  error?: string
  onChange: (file: File | null) => void
  label: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700" htmlFor="document-file">
        {label}
        <span aria-hidden="true" className="ml-0.5 text-danger-600">
          *
        </span>
      </label>
      <input
        id="document-file"
        type="file"
        accept={FILE_ACCEPT}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        aria-invalid={error ? true : undefined}
        className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
      />
      {file ? (
        <p className="text-xs text-slate-500">
          {file.name} · {formatFileSize(file.size)}
        </p>
      ) : (
        <p className="text-xs text-slate-500">PDF, JPEG or PNG. Maximum 10 MB.</p>
      )}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function UploadDocumentDialog({
  parcel,
  onClose,
  onSaved,
}: {
  parcel: ParcelResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<DocumentResponse>()
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<DocumentCategory | ''>('')
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<{
    file?: string
    category?: string
    title?: string
  }>({})
  const [progress, setProgress] = useState(0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: { file?: string; category?: string; title?: string } = {}
    const fileError = validateDocumentFile(file)
    if (fileError) {
      nextErrors.file = fileError
    }
    if (!category) {
      nextErrors.category = 'Select a document category.'
    }
    if (!title.trim()) {
      nextErrors.title = 'Enter a title.'
    } else if (title.trim().length > 200) {
      nextErrors.title = 'Use at most 200 characters.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !file) {
      return
    }

    try {
      await mutation.mutate(() =>
        uploadParcelDocument(
          parcel.id,
          { file, category: category as DocumentCategory, title: title.trim() },
          setProgress,
        ),
      )
      dispatch(addToast({ variant: 'success', message: 'Document uploaded.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message; the form stays filled in.
    } finally {
      setProgress(0)
    }
  }

  return (
    <Modal
      title="Upload document"
      description="The file is stored against this parcel and starts as pending verification."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="upload-document-form" isLoading={mutation.isLoading}>
            {mutation.isLoading ? `Uploading ${progress}%` : 'Upload document'}
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The document was not uploaded" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="upload-document-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <FileField
          label="File"
          file={file}
          error={errors.file}
          onChange={(next) => {
            setFile(next)
            setErrors((current) => ({ ...current, file: undefined }))
          }}
        />

        <Select
          label="Category"
          required
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as DocumentCategory | '')
            setErrors((current) => ({ ...current, category: undefined }))
          }}
          error={errors.category}
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {DOCUMENT_CATEGORY_LABELS[value]}
            </option>
          ))}
        </Select>

        <Input
          label="Title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            setErrors((current) => ({ ...current, title: undefined }))
          }}
          error={errors.title}
          hint={`${title.length}/200 characters`}
        />
      </form>
    </Modal>
  )
}

function UploadVersionDialog({
  document,
  onClose,
  onSaved,
}: {
  document: DocumentResponse
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<DocumentResponse>()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [progress, setProgress] = useState(0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const fileError = validateDocumentFile(file)
    if (fileError) {
      setError(fileError)
      return
    }
    if (!file) {
      return
    }

    try {
      await mutation.mutate(() =>
        uploadDocumentVersion(document.id, file, setProgress),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: 'New version uploaded. Verification is pending again.',
        }),
      )
      onSaved()
    } catch {
      // The mutation keeps the backend message; the form stays filled in.
    } finally {
      setProgress(0)
    }
  }

  return (
    <Modal
      title={`New version of "${document.title}"`}
      description="The current version stays in the history. Verification returns to pending."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="upload-version-form" isLoading={mutation.isLoading}>
            {mutation.isLoading ? `Uploading ${progress}%` : 'Upload version'}
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The new version was not uploaded" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="upload-version-form" onSubmit={handleSubmit} noValidate>
        <FileField
          label="File"
          file={file}
          error={error}
          onChange={(next) => {
            setFile(next)
            setError(undefined)
          }}
        />
      </form>
    </Modal>
  )
}

function DocumentDecisionDialog({
  document,
  outcome,
  onClose,
  onSaved,
}: {
  document: DocumentResponse
  outcome: 'VERIFIED' | 'REJECTED'
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<DocumentResponse>()
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | undefined>()
  const rejecting = outcome === 'REJECTED'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const trimmed = remarks.trim()
    if (rejecting && !trimmed) {
      setError('Remarks are required when rejecting a document.')
      return
    }
    if (trimmed.length > 500) {
      setError('Use at most 500 characters.')
      return
    }

    try {
      await mutation.mutate(() =>
        rejecting
          ? rejectDocument(document.id, trimmed)
          : verifyDocument(document.id, trimmed || undefined),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: rejecting ? 'Document rejected.' : 'Document verified.',
        }),
      )
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title={rejecting ? 'Reject document' : 'Verify document'}
      description={`${document.title} · version ${document.currentVersionNo}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="document-decision-form"
            variant={rejecting ? 'danger' : 'primary'}
            isLoading={mutation.isLoading}
          >
            {rejecting ? 'Reject' : 'Verify'}
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The decision was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="document-decision-form" onSubmit={handleSubmit} noValidate>
        <Textarea
          label={rejecting ? 'Remarks (required)' : 'Remarks (optional)'}
          value={remarks}
          rows={4}
          maxLength={500}
          onChange={(event) => {
            setRemarks(event.target.value)
            setError(undefined)
          }}
          error={error}
          hint={`${remarks.length}/500 characters`}
        />
      </form>
    </Modal>
  )
}
