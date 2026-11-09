import { useId, useState, type FormEvent } from 'react'
import { Download, ImagePlus, Upload } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  downloadSurveyPhoto,
  getSurveyPhotos,
  uploadSurveyPhoto,
} from '../../api/acquisition'
import type { CaseStatus, PhotoResponse, SurveyStatus } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { saveBlob } from '../../utils/download'
import { formatDateTime } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { formatFileSize } from '../landRecords/labels'
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  formatGps,
  isInsideIndia,
  validatePhotoFile,
} from './labels'
import {
  isFutureCapture,
  nowLocalDateTime,
  toIsoInstant,
} from './dates'

const PHOTO_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'

export function SurveyPhotosPanel({
  caseId,
  surveyId,
  caseStatus,
  surveyStatus,
  defaultGps,
}: {
  caseId: string
  surveyId: string
  caseStatus: CaseStatus
  surveyStatus: SurveyStatus
  defaultGps?: { latitude: number; longitude: number }
}) {
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const query = useApiQuery(
    () => getSurveyPhotos(caseId, surveyId),
    [caseId, surveyId],
  )

  const photos = query.data ?? []
  const canUpload =
    can(PERMISSION.SURVEY_PERFORM) &&
    caseStatus === 'SURVEY_IN_PROGRESS' &&
    surveyStatus === 'SUBMITTED' &&
    photos.length < MAX_PHOTOS

  async function download(photo: PhotoResponse) {
    setDownloading(photo.id)
    try {
      const file = await downloadSurveyPhoto(
        caseId,
        surveyId,
        photo.id,
        photo.originalFilename,
      )
      saveBlob(file.blob, file.filename || photo.originalFilename)
    } catch {
      dispatch(
        addToast({
          variant: 'error',
          title: 'Download failed',
          message: 'The photo could not be downloaded. Please try again.',
        }),
      )
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Survey photos"
          description="JPEG or PNG, up to 10 MB and at most 10 photos per survey. Photos are geo-tagged and downloaded through your authenticated session."
          action={
            canUpload ? (
              <Button
                onClick={() => setUploadOpen(true)}
                leftIcon={<ImagePlus aria-hidden="true" className="h-4 w-4" />}
              >
                Upload photo
              </Button>
            ) : null
          }
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={photos.length >= MAX_PHOTOS ? 'warning' : 'neutral'}>
            {photos.length}/{MAX_PHOTOS} photos
          </Badge>
          {!canUpload && photos.length === 0 ? (
            <span className="text-xs text-slate-500">
              Photos can be added only while the survey is awaiting verification.
            </span>
          ) : null}
        </div>

        <Alert variant="info" className="mt-4">
          The backend checks the real file content and the GPS point. Images are never embedded
          inline; use the download button to save a copy.
        </Alert>
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title="Could not load survey photos"
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : query.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      ) : photos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ImagePlus aria-hidden="true" className="h-6 w-6" />}
            title="No photos uploaded"
            description={
              canUpload
                ? 'Upload a geo-tagged photo as evidence for this survey.'
                : 'Photos appear here once the assigned surveyor uploads them.'
            }
            action={
              canUpload ? (
                <Button variant="outline" onClick={() => setUploadOpen(true)}>
                  Upload photo
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {photos.map((photo) => (
            <li key={photo.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-navy-900">
                        {photo.originalFilename}
                      </h3>
                      <Badge variant="neutral">{photo.contentType}</Badge>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(photo.sizeBytes)} · uploaded by{' '}
                      {photo.uploadedByUsername} · {formatDateTime(photo.uploadedAt)}
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">GPS </span>
                      <span className="font-mono">
                        {formatGps(photo.gpsLatitude, photo.gpsLongitude)}
                      </span>
                      {photo.capturedAt ? (
                        <>
                          {' · '}
                          <span className="font-medium text-slate-700">captured </span>
                          {formatDateTime(photo.capturedAt)}
                        </>
                      ) : null}
                    </p>

                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">SHA-256</span>
                      <code
                        title={photo.sha256}
                        className="max-w-full break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                      >
                        {shortSha256(photo.sha256)}
                      </code>
                      <CopyButton value={photo.sha256} label="SHA-256 checksum" />
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={downloading === photo.id}
                    onClick={() => void download(photo)}
                    leftIcon={<Download aria-hidden="true" className="h-3.5 w-3.5" />}
                  >
                    Download
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {uploadOpen ? (
        <UploadPhotoDialog
          caseId={caseId}
          surveyId={surveyId}
          defaultGps={defaultGps}
          onClose={() => setUploadOpen(false)}
          onSaved={() => {
            setUploadOpen(false)
            query.reload()
          }}
        />
      ) : null}
    </div>
  )
}

function shortSha256(value: string): string {
  if (value.length <= 32) {
    return value
  }
  return `${value.slice(0, 16)}…${value.slice(-12)}`
}

function UploadPhotoDialog({
  caseId,
  surveyId,
  defaultGps,
  onClose,
  onSaved,
}: {
  caseId: string
  surveyId: string
  defaultGps?: { latitude: number; longitude: number }
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const fileId = useId()
  const mutation = useApiMutation<PhotoResponse>()
  const [file, setFile] = useState<File | null>(null)
  const [latitude, setLatitude] = useState(
    defaultGps ? String(defaultGps.latitude) : '',
  )
  const [longitude, setLongitude] = useState(
    defaultGps ? String(defaultGps.longitude) : '',
  )
  const [capturedAt, setCapturedAt] = useState('')
  const [errors, setErrors] = useState<{
    file?: string
    latitude?: string
    longitude?: string
    capturedAt?: string
  }>({})
  const [progress, setProgress] = useState(0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: typeof errors = {}
    const fileError = validatePhotoFile(file)
    if (fileError) {
      nextErrors.file = fileError
    }

    const parsedLatitude = Number(latitude)
    const parsedLongitude = Number(longitude)
    if (!latitude.trim() || !Number.isFinite(parsedLatitude)) {
      nextErrors.latitude = 'Enter a numeric latitude.'
    }
    if (!longitude.trim() || !Number.isFinite(parsedLongitude)) {
      nextErrors.longitude = 'Enter a numeric longitude.'
    }
    if (
      !nextErrors.latitude &&
      !nextErrors.longitude &&
      !isInsideIndia(parsedLatitude, parsedLongitude)
    ) {
      nextErrors.latitude = 'The GPS point must be inside India.'
      nextErrors.longitude = 'Check that latitude and longitude are not swapped.'
    }
    if (capturedAt && isFutureCapture(capturedAt)) {
      nextErrors.capturedAt = 'The capture time cannot be in the future.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !file) {
      return
    }

    try {
      await mutation.mutate(() =>
        uploadSurveyPhoto(
          caseId,
          surveyId,
          {
            file,
            latitude: parsedLatitude,
            longitude: parsedLongitude,
            capturedAt: toIsoInstant(capturedAt),
          },
          setProgress,
        ),
      )
      dispatch(addToast({ variant: 'success', message: 'Survey photo uploaded.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message; the form stays filled in.
    } finally {
      setProgress(0)
    }
  }

  return (
    <Modal
      title="Upload a survey photo"
      description="The photo needs its own GPS point. The backend validates the file content and location."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="upload-survey-photo-form"
            isLoading={mutation.isLoading}
            leftIcon={<Upload aria-hidden="true" className="h-4 w-4" />}
          >
            {mutation.isLoading ? `Uploading ${progress}%` : 'Upload photo'}
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The photo was not uploaded" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="upload-survey-photo-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor={fileId}>
            Photo
            <span aria-hidden="true" className="ml-0.5 text-danger-600">
              *
            </span>
          </label>
          <input
            id={fileId}
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setErrors((current) => ({ ...current, file: undefined }))
            }}
            aria-invalid={errors.file ? true : undefined}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
          />
          {file ? (
            <p className="text-xs text-slate-500">
              {file.name} · {formatFileSize(file.size)}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              JPEG or PNG. Maximum 10 MB and {MAX_PHOTOS} photos per survey.
            </p>
          )}
          {errors.file ? (
            <p role="alert" className="text-xs font-medium text-danger-700">
              {errors.file}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="GPS latitude"
            required
            inputMode="decimal"
            value={latitude}
            onChange={(event) => {
              setLatitude(event.target.value)
              setErrors((current) => ({
                ...current,
                latitude: undefined,
                longitude: undefined,
              }))
            }}
            error={errors.latitude}
            hint="Decimal degrees, inside India."
          />
          <Input
            label="GPS longitude"
            required
            inputMode="decimal"
            value={longitude}
            onChange={(event) => {
              setLongitude(event.target.value)
              setErrors((current) => ({
                ...current,
                latitude: undefined,
                longitude: undefined,
              }))
            }}
            error={errors.longitude}
            hint="Decimal degrees, inside India."
          />
        </div>

        <Input
          label="Captured at (optional)"
          type="datetime-local"
          max={nowLocalDateTime()}
          value={capturedAt}
          onChange={(event) => {
            setCapturedAt(event.target.value)
            setErrors((current) => ({ ...current, capturedAt: undefined }))
          }}
          error={errors.capturedAt}
          hint="The backend rejects a capture time more than five minutes in the future."
        />
      </form>
    </Modal>
  )
}

export const SURVEY_PHOTO_MAX_BYTES = MAX_PHOTO_BYTES
