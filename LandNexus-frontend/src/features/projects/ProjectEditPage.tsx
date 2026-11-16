import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { toApiErrorInfo } from '../../api/errors'
import { getProject, updateProject } from '../../api/projects'
import type { ProjectResponse, ProjectType, ProjectUpdateRequest } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { isLinearProjectType } from '../proposals/proposalForm'
import { isProjectType, PROJECT_TYPE_LABELS, PROJECT_TYPES } from '../proposals/labels'
import { VillagePicker, type VillageGroup } from '../proposals/VillagePicker'

interface FormValues {
  title: string
  projectType: ProjectType | ''
  districtId: string
  talukaId: string
  departmentId: string
  lengthKm: string
  estimatedLandAreaHa: string
  villageIds: string[]
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

function toFormValues(project: ProjectResponse): FormValues {
  return {
    title: project.title,
    projectType: project.projectType,
    districtId: project.districtId,
    talukaId: project.talukaId ?? '',
    departmentId: project.departmentId,
    lengthKm: project.lengthKm === null ? '' : String(project.lengthKm),
    estimatedLandAreaHa: String(project.estimatedLandAreaHa),
    villageIds: project.villageIds,
  }
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {}
  if (!values.title.trim()) {
    errors.title = 'Enter a project title.'
  }
  if (!isProjectType(values.projectType)) {
    errors.projectType = 'Select a project type.'
  }
  if (!values.districtId) {
    errors.districtId = 'Select a district.'
  }
  if (!values.departmentId) {
    errors.departmentId = 'Select a department.'
  }
  if (!values.estimatedLandAreaHa.trim() || Number(values.estimatedLandAreaHa) <= 0) {
    errors.estimatedLandAreaHa = 'Enter a land area greater than zero.'
  }
  if (values.lengthKm.trim() && Number(values.lengthKm) <= 0) {
    errors.lengthKm = 'Length must be greater than zero when entered.'
  }
  if (isLinearProjectType(values.projectType) && !values.lengthKm.trim()) {
    errors.lengthKm = 'Length is required for roads, expressways and railways.'
  }
  if (values.villageIds.length === 0) {
    errors.villageIds = 'Select at least one affected village.'
  }
  return errors
}

export function ProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const query = useApiQuery<ProjectResponse | null>(
    () => (id ? getProject(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (query.error) {
    return (
      <Card>
        <ErrorState
          title={query.error.status === 404 ? 'Project not found' : 'Could not load project'}
          message={query.error.message}
          onRetry={query.reload}
        />
        <div className="flex justify-center pb-6">
          <LinkButton to="/projects" variant="outline">
            Back to projects
          </LinkButton>
        </div>
      </Card>
    )
  }

  if (!query.data) {
    return (
      <Card>
        <ErrorState
          title="Project not found"
          message="It may not exist, or you may not have access to it."
        />
      </Card>
    )
  }

  return <ProjectEditForm project={query.data} />
}

function ProjectEditForm({ project }: { project: ProjectResponse }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const refs = useReferenceNames()
  const mutation = useApiMutation<ProjectResponse>()
  const [values, setValues] = useState<FormValues>(() => toFormValues(project))
  const [clientErrors, setClientErrors] = useState<FieldErrors>({})
  const [villageLoad, setVillageLoad] = useState<{
    districtId: string
    isLoading: boolean
    error: string | null
  }>({ districtId: '', isLoading: false, error: null })

  const { ensureDistrictVillages } = refs
  const currentDistrict = values.districtId
  const canManage = can(PERMISSION.PROJECT_MANAGE)

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

  if (!canManage) {
    return (
      <Card>
        <ErrorState
          title="You cannot edit projects"
          message="Editing needs the PROJECT_MANAGE permission. The backend enforces the same rule."
        />
      </Card>
    )
  }

  if (project.status === 'CLOSED') {
    return (
      <>
        <PageHeader
          eyebrow="Module 2 · Government projects"
          title="This project is closed"
          description={`Project ${project.code} cannot be edited while it is closed.`}
        />
        <Card className="p-6">
          <Alert variant="warning" title="Reopen the project first">
            A closed project is read-only. Reopen it from the project page to make further
            changes.
          </Alert>
          <div className="mt-4">
            <LinkButton to={`/projects/${project.id}`}>Back to project</LinkButton>
          </div>
        </Card>
      </>
    )
  }

  if (refs.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
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

  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === values.districtId,
  )
  const departmentOptions = refs.departments.filter(
    (department) => department.status === 'ACTIVE' || department.id === values.departmentId,
  )
  const talukas = refs
    .talukasForDistrict(values.districtId)
    .filter((taluka) => taluka.status === 'ACTIVE' || taluka.id === values.talukaId)
  const villagesByTaluka = refs.villagesByTaluka(values.districtId)
  const villageGroups: VillageGroup[] = talukas.map((taluka) => ({
    taluka,
    villages: (villagesByTaluka.get(taluka.id) ?? []).filter(
      (village) => village.status === 'ACTIVE' || values.villageIds.includes(village.id),
    ),
  }))
  const villagesLoading =
    villageLoad.districtId === values.districtId && villageLoad.isLoading

  function updateValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setClientErrors((current) => ({ ...current, [key]: undefined }))
  }

  function applyDistrict(nextDistrictId: string) {
    setValues((current) => ({
      ...current,
      districtId: nextDistrictId,
      talukaId: '',
      villageIds: [],
    }))
  }

  function fieldError(field: keyof FormValues): string | undefined {
    if (clientErrors[field]) {
      return clientErrors[field]
    }
    const serverField = mutation.error?.fieldErrors.find((entry) => entry.field === field)
    return serverField?.message
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors = validate(values)
    setClientErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }
    if (!isProjectType(values.projectType)) {
      return
    }

    const request: ProjectUpdateRequest = {
      title: values.title.trim(),
      projectType: values.projectType,
      districtId: values.districtId,
      talukaId: values.talukaId || null,
      departmentId: values.departmentId,
      lengthKm: values.lengthKm.trim() ? Number(values.lengthKm) : null,
      estimatedLandAreaHa: Number(values.estimatedLandAreaHa),
      villageIds: values.villageIds,
    }

    try {
      await mutation.mutate(() => updateProject(project.id, request))
      dispatch(addToast({ variant: 'success', message: 'Project details updated.' }))
      navigate(`/projects/${project.id}`)
    } catch {
      // The mutation keeps the error; the form stays filled in.
    }
  }

  const showTopError = mutation.error !== null && mutation.error.fieldErrors.length === 0

  return (
    <>
      <PageHeader
        eyebrow="Module 2 · Government projects"
        title="Edit project"
        description={`Project ${project.code}. The code, originating proposal and approval facts cannot change.`}
        actions={
          <LinkButton to={`/projects/${project.id}`} variant="outline">
            Cancel
          </LinkButton>
        }
      />

      {showTopError && mutation.error ? (
        <Alert variant="error" title="The project was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Card className="p-5">
          <CardHeader
            title="Basic information"
            description="Correcting a project does not change the approved proposal or its history."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Title"
              required
              value={values.title}
              onChange={(event) => updateValue('title', event.target.value)}
              maxLength={200}
              error={fieldError('title')}
              containerClassName="md:col-span-2"
            />

            <Select
              label="Project type"
              required
              value={values.projectType}
              onChange={(event) =>
                updateValue('projectType', event.target.value as FormValues['projectType'])
              }
              error={fieldError('projectType')}
            >
              <option value="">Select a project type</option>
              {PROJECT_TYPES.map((projectType) => (
                <option key={projectType} value={projectType}>
                  {PROJECT_TYPE_LABELS[projectType]}
                </option>
              ))}
            </Select>

            <Select
              label="Department"
              required
              value={values.departmentId}
              onChange={(event) => updateValue('departmentId', event.target.value)}
              error={fieldError('departmentId')}
            >
              <option value="">Select a department</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            title="Location"
            description="The state is derived from the district. Changing the district clears the taluka and villages."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Select
              label="District"
              required
              value={values.districtId}
              onChange={(event) => applyDistrict(event.target.value)}
              error={fieldError('districtId')}
              hint="Only districts in your assigned scope are listed."
            >
              <option value="">Select a district</option>
              {districtOptions.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </Select>

            <Select
              label="Taluka (optional)"
              value={values.talukaId}
              onChange={(event) => updateValue('talukaId', event.target.value)}
              error={fieldError('talukaId')}
              disabled={!values.districtId || villagesLoading}
            >
              <option value="">No specific taluka</option>
              {talukas.map((taluka) => (
                <option key={taluka.id} value={taluka.id}>
                  {taluka.name}
                </option>
              ))}
            </Select>

            <div className="md:col-span-2">
              <VillagePicker
                groups={villageGroups}
                selectedIds={values.villageIds}
                onChange={(ids) => updateValue('villageIds', ids)}
                isLoading={villagesLoading || refs.isDistrictVillagesLoading(values.districtId)}
                error={villageLoad.districtId === values.districtId ? villageLoad.error : null}
                disabled={!values.districtId}
                fieldError={fieldError('villageIds')}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            title="Project details"
            description="Area is measured in hectares."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Length (km)"
              required={isLinearProjectType(values.projectType)}
              inputMode="decimal"
              value={values.lengthKm}
              onChange={(event) => updateValue('lengthKm', event.target.value)}
              error={fieldError('lengthKm')}
              hint={
                isLinearProjectType(values.projectType)
                  ? 'Required for roads, expressways and railways.'
                  : 'Optional for this project type.'
              }
            />

            <Input
              label="Estimated land area (ha)"
              required
              inputMode="decimal"
              value={values.estimatedLandAreaHa}
              onChange={(event) => updateValue('estimatedLandAreaHa', event.target.value)}
              error={fieldError('estimatedLandAreaHa')}
            />
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-card backdrop-blur">
          <p className="text-xs text-slate-500">
            The backend validates the same rules and records the change in the audit trail.
          </p>
          <div className="flex gap-2">
            <LinkButton to={`/projects/${project.id}`} variant="outline">
              Cancel
            </LinkButton>
            <Button type="submit" isLoading={mutation.isLoading}>
              {mutation.isLoading ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
