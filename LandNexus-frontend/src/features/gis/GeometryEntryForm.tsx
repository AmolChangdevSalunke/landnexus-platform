import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { FileJson } from 'lucide-react'
import type { Feature, FeatureCollection, Geometry, MapProps } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { GeoJsonSvg } from './GeoJsonSvg'
import {
  parseGeometryInput,
  readGeometryFile,
  type GeometryKind,
} from './geometryInput'

export interface GeometryEntryFormProps {
  kind: GeometryKind
  previewProperties: MapProps
  submitLabel: string
  onSave: (geometry: Geometry, sourceNote: string) => Promise<void>
  isSaving: boolean
  serverError: string | null
  extraFields?: ReactNode
  validateExtra?: () => string | null
  previewLabel: string
}

/**
 * Shared entry form for a parcel boundary and a project alignment.
 *
 * The file is read in the browser only. The form pre-checks the GeoJSON so a
 * preview can be drawn, but the server remains the authority and its error
 * text is shown verbatim.
 */
export function GeometryEntryForm({
  kind,
  previewProperties,
  submitLabel,
  onSave,
  isSaving,
  serverError,
  extraFields,
  validateExtra,
  previewLabel,
}: GeometryEntryFormProps) {
  const formId = useId()
  const fileId = useId()
  const [text, setText] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [extraError, setExtraError] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const parsed = useMemo(() => parseGeometryInput(text, kind), [text, kind])
  const showErrors = hasSubmitted || text.trim().length > 0

  const previewData: FeatureCollection<MapProps> | null = parsed.geometry
    ? {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: parsed.geometry,
            properties: previewProperties,
          } satisfies Feature<MapProps>,
        ],
      }
    : null

  async function readFile(file: File | undefined) {
    if (!file) {
      return
    }
    setFileError(null)
    try {
      const contents = await readGeometryFile(file)
      setText(contents)
      setFileName(file.name)
      setHasSubmitted(false)
    } catch {
      setFileError('The file could not be read in this browser.')
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) {
      return
    }
    setHasSubmitted(true)
    setExtraError(null)
    if (!parsed.geometry || parsed.errors.length > 0) {
      return
    }
    if (validateExtra) {
      const extraMessage = validateExtra()
      if (extraMessage) {
        setExtraError(extraMessage)
        return
      }
    }
    await onSave(parsed.geometry, sourceNote.trim())
  }

  return (
    <Card className="p-4">
      <CardHeader
        title={kind === 'polygon' ? 'Enter a boundary' : 'Enter an alignment'}
        description={
          kind === 'polygon'
            ? 'Paste one GeoJSON Polygon or MultiPolygon. The API expects one bare geometry, not a Feature.'
            : 'Paste one GeoJSON LineString or MultiLineString. The API expects one bare geometry, not a Feature.'
        }
      />

      {serverError ? (
        <Alert variant="error" title="The server did not accept this geometry" className="mt-3">
          {serverError}
        </Alert>
      ) : null}

      <form id={formId} noValidate className="mt-4 space-y-4" onSubmit={submit}>
        <Textarea
          label="GeoJSON geometry"
          required
          rows={8}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setFileName(null)
          }}
          error={
            showErrors && parsed.errors.length > 0 ? parsed.errors[0] : undefined
          }
          hint="Coordinates are [longitude, latitude] in WGS84. Do not paste a base map or a tile URL."
        />

        <div>
          <label
            htmlFor={fileId}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"
          >
            <FileJson aria-hidden="true" className="h-4 w-4" />
            Read a .geojson or .json file in this browser
          </label>
          <input
            id={fileId}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <p className="mt-1 text-xs text-slate-500">
            The file is read locally. Nothing is uploaded until you press {submitLabel}.
            {fileName ? ` Selected file: ${fileName}.` : ''}
          </p>
          {fileError ? (
            <p role="alert" className="mt-1 text-xs font-medium text-danger-700">
              {fileError}
            </p>
          ) : null}
        </div>

        {parsed.unwrapped ? (
          <Alert variant="info" title="Geometry unwrapped">
            {parsed.unwrapped}
          </Alert>
        ) : null}

        {showErrors && parsed.errors.length > 1 ? (
          <Alert variant="error" title="Check the GeoJSON">
            <ul className="list-disc space-y-0.5 pl-5">
              {parsed.errors.slice(1).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {parsed.warnings.length > 0 ? (
          <Alert variant="warning" title="Check before saving">
            <ul className="list-disc space-y-0.5 pl-5">
              {parsed.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {extraFields}
        {extraError ? (
          <p role="alert" className="text-xs font-medium text-danger-700">
            {extraError}
          </p>
        ) : null}

        <Input
          label="Source note (optional)"
          value={sourceNote}
          maxLength={500}
          onChange={(event) => setSourceNote(event.target.value)}
          hint="For example the survey office or notification the geometry came from."
        />

        <Button type="submit" isLoading={isSaving} disabled={!parsed.geometry}>
          {submitLabel}
        </Button>
      </form>

      {previewData ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-navy-900">Preview</h4>
          <p className="mb-2 text-xs text-slate-500">
            Drawn from the text above with the same SVG renderer as the project map. The server
            still checks the geometry.
          </p>
          <GeoJsonSvg data={previewData} height={360} label={previewLabel} />
        </div>
      ) : null}
    </Card>
  )
}
