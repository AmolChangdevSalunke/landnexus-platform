import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Eye, FileUp, ShieldCheck, XCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { downloadDocumentVersion, getDocument, getParcel } from '../../api/landRecords'
import type {
  DocumentResponse,
  DocumentVersion,
  ParcelResponse,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { saveBlob } from '../../utils/download'
import { formatDateTime, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { DocumentPreviewDialog, isPreviewable } from './DocumentPreviewDialog'
import { DocumentDecisionDialog, UploadVersionDialog } from './DocumentsTab'
import {
  DOCUMENT_CATEGORY_LABELS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_VARIANTS,
  formatFileSize,
  parcelIdentifier,
} from './labels'

function currentVersion(document: DocumentResponse): DocumentVersion | null {
  return (
    document.versions.find(
      (version) => version.versionNo === document.currentVersionNo,
    ) ??
    document.versions[document.versions.length - 1] ??
    null
  )
}

/**
 * Deep link for one document. The backend exposes a document by id, so this
 * page can show its metadata and full version history without loading the whole
 * parcel. Actions are the same ones used by the parcel documents tab.
 */
export function DocumentDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { can, user } = useAuth()
  const dispatch = useAppDispatch()
  const [versionTarget, setVersionTarget] = useState<DocumentResponse | null>(null)
  const [decision, setDecision] = useState<{
    document: DocumentResponse
    outcome: 'VERIFIED' | 'REJECTED'
  } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null)

  const documentQuery = useApiQuery<DocumentResponse | null>(
    () => (id ? getDocument(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  const parcelQuery = useApiQuery<ParcelResponse | null>(
    () =>
      documentQuery.data
        ? getParcel(documentQuery.data.parcelId)
        : Promise.resolve(null),
    [documentQuery.data?.parcelId],
    Boolean(documentQuery.data?.parcelId),
  )

  const document = documentQuery.data
  const parcel = parcelQuery.data

  async function download(
    target: DocumentResponse,
    version: DocumentVersion,
  ): Promise<void> {
    const key = `${target.id}:${version.versionNo}`
    setDownloading(key)
    try {
      const file = await downloadDocumentVersion(
        target.id,
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

  if (documentQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (documentQuery.error || !document) {
    return (
      <>
        <PageHeader
          eyebrow="Module 3 · Land records"
          title="Document"
          description="The document could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              documentQuery.error?.status === 404
                ? 'Document not found'
                : documentQuery.error?.status === 403
                  ? 'You do not have access'
                  : 'Could not load the document'
            }
            message={
              documentQuery.error?.message ??
              'It may not exist, or you may not have access to it.'
            }
            onRetry={documentQuery.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/land/documents" variant="outline">
              Back to document register
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  const current = currentVersion(document)
  const canUpload =
    can(PERMISSION.DOCUMENT_UPLOAD) && parcel?.status !== 'INACTIVE'
  const canDecide =
    can(PERMISSION.DOCUMENT_VERIFY) &&
    document.verificationStatus === 'PENDING' &&
    current?.uploadedByUsername !== user?.username
  const uploadedByMe =
    current?.uploadedByUsername === user?.username &&
    document.verificationStatus === 'PENDING'

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Land records"
        title={document.title}
        description={`${DOCUMENT_CATEGORY_LABELS[document.category]} · ${
          parcel
            ? parcelIdentifier(parcel)
            : `Parcel ${shortId(document.parcelId)}`
        }`}
        actions={
          <>
            <LinkButton
              to={`/land/documents?parcelId=${document.parcelId}`}
              variant="outline"
              leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
            >
              Back to register
            </LinkButton>
            {canUpload ? (
              <Button
                onClick={() => setVersionTarget(document)}
                leftIcon={<FileUp aria-hidden="true" className="h-4 w-4" />}
              >
                New version
              </Button>
            ) : null}
            {canDecide ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDecision({ document, outcome: 'VERIFIED' })}
                  leftIcon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
                >
                  Verify
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDecision({ document, outcome: 'REJECTED' })}
                  leftIcon={<XCircle aria-hidden="true" className="h-4 w-4" />}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {document.verificationStatus === 'REJECTED' ? (
        <Alert variant="error" title="This document was rejected" className="mb-4">
          {document.verificationRemarks || 'No remarks were recorded.'}
        </Alert>
      ) : null}

      {uploadedByMe ? (
        <Alert variant="info" className="mb-4">
          You uploaded the current version. Another officer must verify or reject it.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <CardHeader
            title="Document details"
            description="Metadata is returned by the backend; the file itself is downloaded separately."
          />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Parcel">
              {parcel ? (
                <Link
                  to={`/land/parcels/${parcel.id}`}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  {parcelIdentifier(parcel)}
                </Link>
              ) : (
                <span title={document.parcelId} className="font-mono text-xs">
                  {shortId(document.parcelId)}
                </span>
              )}
            </DetailItem>
            <DetailItem label="Category">
              {DOCUMENT_CATEGORY_LABELS[document.category]}
            </DetailItem>
            <DetailItem label="Verification">
              <Badge variant={VERIFICATION_STATUS_VARIANTS[document.verificationStatus]}>
                {VERIFICATION_STATUS_LABELS[document.verificationStatus]}
              </Badge>
            </DetailItem>
            <DetailItem label="Current version">
              {document.currentVersionNo}
            </DetailItem>
            <DetailItem label="Created">
              {formatDateTime(document.createdAt)}
            </DetailItem>
            <DetailItem label="Last updated">
              {formatDateTime(document.updatedAt)}
            </DetailItem>
            <DetailItem label="Verified at">
              {document.verifiedAt ? formatDateTime(document.verifiedAt) : '—'}
            </DetailItem>
            <DetailItem label="Verified version">
              {document.verifiedVersionNo ?? '—'}
            </DetailItem>
            <DetailItem label="Verified by">
              {document.verifiedByUserId ? (
                <span title={document.verifiedByUserId} className="font-mono text-xs">
                  {shortId(document.verifiedByUserId)}
                </span>
              ) : (
                '—'
              )}
            </DetailItem>
            <DetailItem label="Remarks">
              {document.verificationRemarks || '—'}
            </DetailItem>
          </dl>
        </Card>

        <Card className="p-4">
          <CardHeader
            title="Current file"
            description="Downloads use your authenticated session and are audited."
          />
          {current ? (
            <div className="mt-4 space-y-3">
              <p className="break-all text-sm font-semibold text-slate-800">
                {current.originalFilename}
              </p>
              <p className="text-xs text-slate-500">
                {current.contentType} · {formatFileSize(current.sizeBytes)}
              </p>
              <p className="text-xs text-slate-500">
                Uploaded by {current.uploadedByUsername} ·{' '}
                {formatDateTime(current.uploadedAt)}
              </p>
              <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                <span className="font-medium text-slate-600">SHA-256</span>
                <code
                  title={current.sha256}
                  className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                >
                  {current.sha256}
                </code>
                <CopyButton value={current.sha256} label="SHA-256 checksum" />
              </p>
              <div className="flex flex-wrap gap-2">
                {isPreviewable(current.contentType) ? (
                  <Button
                    variant="outline"
                    onClick={() => setPreviewVersion(current)}
                    leftIcon={<Eye aria-hidden="true" className="h-4 w-4" />}
                  >
                    Preview current version
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  isLoading={downloading === `${document.id}:${current.versionNo}`}
                  onClick={() => void download(document, current)}
                  leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}
                >
                  Download current version
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No file version is recorded.</p>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <CardHeader
          title={`Version history (${document.versions.length})`}
          description="Every upload is kept. A new version returns verification to pending."
        />
        {document.versions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No versions are recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {document.versions
              .slice()
              .sort((a, b) => b.versionNo - a.versionNo)
              .map((version) => (
                <li
                  key={version.versionNo}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">
                      v{version.versionNo} · {version.originalFilename}
                      {version.versionNo === document.currentVersionNo ? (
                        <Badge variant="info" className="ml-2">
                          Current
                        </Badge>
                      ) : null}
                    </p>
                    <p>
                      {version.contentType} · {formatFileSize(version.sizeBytes)} ·{' '}
                      {version.uploadedByUsername} · {formatDateTime(version.uploadedAt)}
                    </p>
                    <p className="break-all font-mono text-[10px] text-slate-500">
                      SHA-256 {version.sha256}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {isPreviewable(version.contentType) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewVersion(version)}
                      >
                        Preview v{version.versionNo}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={downloading === `${document.id}:${version.versionNo}`}
                      onClick={() => void download(document, version)}
                    >
                      Download v{version.versionNo}
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Card>

      {previewVersion ? (
        <DocumentPreviewDialog
          documentId={document.id}
          version={previewVersion}
          onClose={() => setPreviewVersion(null)}
        />
      ) : null}

      {versionTarget ? (
        <UploadVersionDialog
          document={versionTarget}
          onClose={() => setVersionTarget(null)}
          onSaved={() => {
            setVersionTarget(null)
            documentQuery.reload()
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
            documentQuery.reload()
          }}
        />
      ) : null}
    </>
  )
}

function DetailItem({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  )
}
