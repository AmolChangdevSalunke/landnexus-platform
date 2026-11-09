import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { toApiErrorInfo } from '../../api/errors'
import { createParcel, getParcel, updateParcel } from '../../api/landRecords'
import type {
  LandClassification,
  LandUse,
  ParcelResponse,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { useAuth } from '../auth/useAuth'
import {
  LAND_CLASSIFICATION_LABELS,
  LAND_USE_LABELS,
} from './labels'
import {
  emptyParcelForm,
  parcelToFormValues,
  serverParcelFieldError,
  toParcelRequest,
  validateParcelForm,
  type ParcelFormErrors,
  type ParcelFormValues,
} from './parcelForm'

const LAND_CLASSIFICATIONS = Object.keys(
  LAND_CLASSIFICATION_LABELS,
) as LandClassification[]
const LAND_USES = Object.keys(LAND_USE_LABELS) as LandUse[]

export function ParcelFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const parcelQuery = useApiQuery(
    () => (id ? getParcel(id) : Promise.resolve(null)),
    [id],
    isEdit,
  )

  if (isEdit && parcelQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isEdit && parcelQuery.error) {
    return (
      <Card>
        <ErrorState
          title={parcelQuery.error.status === 404 ? 'Parcel not found' : 'Could not load parcel'}
          message={parcelQuery.error.message}
          onRetry={parcelQuery.reload}
        />
        <div className="flex justify-center pb-6">
          <LinkButton to="/land/parcels" variant="outline">
            Back to parcels
          </LinkButton>
        </div>
      </Card>
    )
  }

  if (isEdit && !parcelQuery.data) {
    return (
      <Card>
        <ErrorState
          title="Parcel not found"
          message="It may not exist, or you may not have access to it."
        />
      </Card>
    )
  }

  return <ParcelFormLayout parcel={parcelQuery.data ?? undefined} />
}

function ParcelFormLayout({ parcel }: { parcel?: ParcelResponse }) {
  const { can } = useAuth()
  const isEdit = Boolean(parcel)

  if (parcel && !can('LAND_RECORD_WRITE')) {
    return (
      <>
        <PageHeader
          eyebrow="Module 3 · Land records"
          title="This parcel cannot be edited"
          description="Land record write permission is required."
        />
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-700">
              <AlertTriangle aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-navy-900">Editing is not available</h2>
              <p className="mt-1 text-sm text-slate-600">
                The backend enforces the same permission rule.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton to={`/land/parcels/${parcel.id}`}>View parcel</LinkButton>
                <LinkButton to="/land/parcels" variant="outline">
                  Back to parcels
                </LinkButton>
              </div>
            </div>
          </div>
        </Card>
      </>
    )
  }

  if (parcel && parcel.status !== 'ACTIVE') {
    return (
      <>
        <PageHeader
          eyebrow="Module 3 · Land records"
          title="This parcel cannot be edited"
          description="An inactive parcel cannot be changed until it is activated."
        />
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-700">
              <AlertTriangle aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-navy-900">Parcel is inactive</h2>
              <p className="mt-1 text-sm text-slate-600">
                Activate the parcel from its details page before changing it.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton to={`/land/parcels/${parcel.id}`}>View parcel</LinkButton>
                <LinkButton to="/land/parcels" variant="outline">
                  Back to parcels
                </LinkButton>
              </div>
            </div>
          </div>
        </Card>
      </>
    )
  }

  return <ParcelForm parcel={parcel} isEdit={isEdit} />
}

function ParcelForm({ parcel, isEdit }: { parcel?: ParcelResponse; isEdit: boolean }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<ParcelResponse>()
  const refs = useReferenceNames()
  const formRef = useRef<HTMLFormElement>(null)

  const [values, setValues] = useState<ParcelFormValues>(() =>
    parcel ? parcelToFormValues(parcel) : emptyParcelForm(),
  )
  const [clientErrors, setClientErrors] = useState<ParcelFormErrors>({})
  const [pendingDistrictId, setPendingDistrictId] = useState<string | null>(null)
  const [villageLoad, setVillageLoad] = useState<{
    districtId: string
    isLoading: boolean
    error: string | null
  }>({ districtId: '', isLoading: false, error: null })

  const { ensureDistrictVillages } = refs
  const currentDistrict = values.districtId

  useEffect(() => {
    if (!currentDistrict) {
      setVillageLoad({ districtId: '', isLoading: false, error: null })
      return
    }

    let active = true
    setVillageLoad({ districtId: currentDistrict, isLoading: true, error: null })

    ensureDistrictVillages(currentDistrict)
      .then(() => {
        if (active) {
          setVillageLoad({ districtId: currentDistrict, isLoading: false, error: null })
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setVillageLoad({
            districtId: currentDistrict,
            isLoading: false,
            error: toApiErrorInfo(caught).message,
          })
        }
      })

    return () => {
      active = false
    }
  }, [currentDistrict, ensureDistrictVillages])

  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === values.districtId,
  )
  const talukas = refs
    .talukasForDistrict(values.districtId)
    .filter((taluka) => taluka.status === 'ACTIVE' || taluka.id === values.talukaId)
  const villages = refs
    .villagesForDistrict(values.districtId)
    .filter((village) => village.status === 'ACTIVE' || village.id === values.villageId)

  const villagesLoading =
    villageLoad.districtId === values.districtId && villageLoad.isLoading
  const noDistricts = refs.enabled && !refs.isLoading && districtOptions.length === 0

  const serverError = mutation.error
  const showTopError =
    serverError !== null &&
    (serverError.fieldErrors.length === 0 || serverError.status !== 400)

  function fieldError(field: keyof ParcelFormValues): string | undefined {
    return serverParcelFieldError(serverError, field) ?? clientErrors[field]
  }

  function updateValue<K extends keyof ParcelFormValues>(
    key: K,
    value: ParcelFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
    setClientErrors((current) => ({ ...current, [key]: undefined }))
  }

  function applyDistrict(nextDistrictId: string) {
    setValues((current) => ({
      ...current,
      districtId: nextDistrictId,
      talukaId: '',
      villageId: '',
    }))
    setClientErrors((current) => ({
      ...current,
      districtId: undefined,
      talukaId: undefined,
      villageId: undefined,
    }))
  }

  function handleDistrictChange(nextDistrictId: string) {
    if (nextDistrictId === values.districtId) {
      return
    }
    if (values.villageId) {
      setPendingDistrictId(nextDistrictId)
      return
    }
    applyDistrict(nextDistrictId)
  }

  function handleTalukaChange(nextTalukaId: string) {
    setValues((current) => ({ ...current, talukaId: nextTalukaId, villageId: '' }))
    setClientErrors((current) => ({
      ...current,
      talukaId: undefined,
      villageId: undefined,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors = validateParcelForm(values)
    setClientErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus()
      }, 0)
      return
    }

    const request = toParcelRequest(values)

    try {
      const saved = parcel
        ? await mutation.mutate(() => updateParcel(parcel.id, request))
        : await mutation.mutate(() => createParcel(request))

      dispatch(
        addToast({
          variant: 'success',
          message: parcel ? 'Parcel updated.' : 'Parcel created.',
        }),
      )
      navigate(`/land/parcels/${saved.id}`)
    } catch {
      // The mutation hook keeps the error; the form stays filled in.
    }
  }

  if (refs.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Card className="flex min-h-48 items-center justify-center gap-2 p-6 text-sm text-slate-600">
          <Spinner label="Loading administrative geography" />
          <span>Loading districts and villages…</span>
        </Card>
      </div>
    )
  }

  if (refs.error) {
    return (
      <Card>
        <ErrorState
          title="Could not load master data"
          message={refs.error.message}
          onRetry={refs.reload}
        />
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Land records"
        title={isEdit ? 'Edit parcel' : 'New parcel'}
        description="A parcel belongs to one village. At least one of the Gat or Survey number is required."
        actions={
          <LinkButton
            to={parcel ? `/land/parcels/${parcel.id}` : '/land/parcels'}
            variant="outline"
          >
            Cancel
          </LinkButton>
        }
      />

      {noDistricts ? (
        <Alert variant="warning" title="No districts are assigned to your account" className="mb-4">
          Ask an administrator to assign a district scope. You cannot create a parcel without one.
        </Alert>
      ) : null}

      {showTopError && serverError ? (
        <Alert variant="error" title="The parcel was not saved" className="mb-4">
          {serverError.message}
        </Alert>
      ) : null}

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Card className="p-5">
          <CardHeader
            title="Location"
            description="District and taluka narrow down the village list. The server derives the state from the village."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Select
              label="District"
              required
              value={values.districtId}
              onChange={(event) => handleDistrictChange(event.target.value)}
              error={fieldError('districtId')}
              disabled={isEdit}
              hint={
                isEdit
                  ? 'A parcel cannot be moved to another village or district.'
                  : 'Only districts in your assigned scope are listed.'
              }
            >
              <option value="">Select a district</option>
              {districtOptions.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                  {district.status !== 'ACTIVE' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>

            <Select
              label="Taluka"
              required
              value={values.talukaId}
              onChange={(event) => handleTalukaChange(event.target.value)}
              error={fieldError('talukaId')}
              disabled={isEdit || !values.districtId || villagesLoading}
            >
              <option value="">Select a taluka</option>
              {talukas.map((taluka) => (
                <option key={taluka.id} value={taluka.id}>
                  {taluka.name}
                  {taluka.status !== 'ACTIVE' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>

            <Select
              label="Village"
              required
              value={values.villageId}
              onChange={(event) => updateValue('villageId', event.target.value)}
              error={fieldError('villageId')}
              disabled={isEdit || !values.talukaId || villagesLoading}
              hint={
                isEdit
                  ? 'The village of an existing parcel is read-only.'
                  : 'Villages are loaded for the selected taluka.'
              }
            >
              <option value="">Select a village</option>
              {villages
                .filter((village) => village.talukaId === values.talukaId)
                .map((village) => (
                  <option key={village.id} value={village.id}>
                    {village.name}
                    {village.status !== 'ACTIVE' ? ' (inactive)' : ''}
                  </option>
                ))}
            </Select>
          </div>

          {villageLoad.districtId === values.districtId && villageLoad.error ? (
            <p role="alert" className="mt-3 text-xs font-medium text-danger-700">
              Villages could not be loaded. {villageLoad.error}
            </p>
          ) : null}
        </Card>

        <Card className="p-5">
          <CardHeader
            title="Parcel identifiers"
            description="Identifiers are stored in upper case by the backend. At least one of Gat or Survey is mandatory."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Input
              label="Gat number"
              value={values.gatNumber}
              onChange={(event) => updateValue('gatNumber', event.target.value)}
              maxLength={30}
              error={fieldError('gatNumber')}
            />
            <Input
              label="Survey number"
              value={values.surveyNumber}
              onChange={(event) => updateValue('surveyNumber', event.target.value)}
              maxLength={30}
              error={fieldError('surveyNumber')}
            />
            <Input
              label="Subdivision number"
              value={values.subdivisionNumber}
              onChange={(event) => updateValue('subdivisionNumber', event.target.value)}
              maxLength={30}
              error={fieldError('subdivisionNumber')}
            />
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            title="Land details"
            description="Area is measured in hectares. Classification and land use come from the backend's fixed lists."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Input
              label="Area (ha)"
              required
              inputMode="decimal"
              value={values.areaHa}
              onChange={(event) => updateValue('areaHa', event.target.value)}
              error={fieldError('areaHa')}
              hint="Positive, maximum four decimal places."
            />
            <Select
              label="Classification"
              required
              value={values.classification}
              onChange={(event) =>
                updateValue(
                  'classification',
                  event.target.value as ParcelFormValues['classification'],
                )
              }
              error={fieldError('classification')}
            >
              <option value="">Select a classification</option>
              {LAND_CLASSIFICATIONS.map((classification) => (
                <option key={classification} value={classification}>
                  {LAND_CLASSIFICATION_LABELS[classification]}
                </option>
              ))}
            </Select>
            <Select
              label="Land use"
              required
              value={values.landUse}
              onChange={(event) =>
                updateValue('landUse', event.target.value as ParcelFormValues['landUse'])
              }
              error={fieldError('landUse')}
            >
              <option value="">Select a land use</option>
              {LAND_USES.map((landUse) => (
                <option key={landUse} value={landUse}>
                  {LAND_USE_LABELS[landUse]}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-card backdrop-blur">
          <p className="text-xs text-slate-500">
            The server validates the same rules. Unsaved changes are lost if you leave this page.
          </p>
          <div className="flex gap-2">
            <LinkButton
              to={parcel ? `/land/parcels/${parcel.id}` : '/land/parcels'}
              variant="outline"
            >
              Cancel
            </LinkButton>
            <Button
              type="submit"
              isLoading={mutation.isLoading}
              disabled={mutation.isLoading || noDistricts}
            >
              {parcel ? 'Save changes' : 'Create parcel'}
            </Button>
          </div>
        </div>
      </form>

      {pendingDistrictId ? (
        <ConfirmDialog
          title="Change district?"
          message="Changing the district clears the selected taluka and village. Continue?"
          confirmLabel="Change district"
          onConfirm={() => {
            applyDistrict(pendingDistrictId)
            setPendingDistrictId(null)
          }}
          onClose={() => setPendingDistrictId(null)}
        />
      ) : null}
    </>
  )
}
