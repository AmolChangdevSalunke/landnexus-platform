import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { previewDocumentVersion } from '../../api/landRecords'
import type { DocumentVersion } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { saveBlob } from '../../utils/download'

const PREVIEWABLE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])

export function isPreviewable(contentType: string): boolean {
  return PREVIEWABLE_TYPES.has(contentType.split(';')[0].trim().toLowerCase())
}

interface PreviewState {
  url: string
  blob: Blob
  filename: string
  contentType: string
}

interface DocumentPreviewDialogProps {
  documentId: string
  version: DocumentVersion
  onClose: () => void
}

/**
 * Inline preview of one document version. The file is fetched through the
 * authenticated client and shown from a temporary object URL, which is revoked
 * when the dialog closes. Non-PDF/image types fall back to a download action.
 */
export function DocumentPreviewDialog({
  documentId,
  version,
  onClose,
}: DocumentPreviewDialogProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    previewDocumentVersion(documentId, version.versionNo, version.originalFilename)
      .then((file) => {
        if (cancelled) {
          return
        }
        objectUrl = URL.createObjectURL(file.blob)
        setPreview({
          url: objectUrl,
          blob: file.blob,
          filename: file.filename,
          contentType: file.contentType,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setError('The file could not be loaded for preview. Close this dialog and use the download action instead.')
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [documentId, version.originalFilename, version.versionNo])

  const download = () => {
    if (preview) {
      saveBlob(preview.blob, preview.filename || version.originalFilename)
    }
  }

  return (
    <Modal
      title={`Preview v${version.versionNo}`}
      description={`${version.originalFilename} · shown from your authenticated session.`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {preview && isPreviewable(preview.contentType) ? (
            <Button
              variant="outline"
              onClick={download}
              leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}
            >
              Download
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {error ? (
        <Alert variant="error" title="Preview unavailable">
          {error}
        </Alert>
      ) : !preview ? (
        <div className="space-y-3">
          <Skeleton className="h-[55vh] w-full" />
          <p className="text-sm text-slate-500">Loading preview…</p>
        </div>
      ) : preview.contentType === 'application/pdf' ? (
        <iframe
          title={`Preview of ${preview.filename}`}
          src={preview.url}
          className="h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-50"
        />
      ) : preview.contentType.startsWith('image/') ? (
        <img
          src={preview.url}
          alt={`Preview of ${preview.filename}`}
          className="mx-auto max-h-[70vh] rounded-lg border border-slate-200 object-contain"
        />
      ) : (
        <Alert variant="info" title="Preview not supported">
          This file type cannot be shown inline. Use the download action to open it.
        </Alert>
      )}
    </Modal>
  )
}
