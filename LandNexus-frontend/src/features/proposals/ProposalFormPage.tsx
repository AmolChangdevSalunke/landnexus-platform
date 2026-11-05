import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { toApiErrorInfo } from '../../api/errors'
import { createProposal, getProposal, updateProposal } from '../../api/proposals'
import type { ProposalResponse } from '../../api/types'
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
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatNumber } from '../../utils/format'
import { useAuth } from '../auth/useAuth'
import { PROPOSAL_LIMITS, proposalToFormValues, toProposalRequest, validateProposalForm, serverFieldError, emptyProposalForm, isLinearProjectType, type ProposalFormErrors, type ProposalFormValues } from './proposalForm'
import { isProjectType, PROJECT_TYPE_LABELS, PROJECT_TYPES } from './labels'
import { VillagePicker, type VillageGroup } from './VillagePicker'

const EDITABLE_STATUSES = new Set(['DRAFT', 'CLARIFICATION_REQUESTED'])

function canEditProposal(proposal: ProposalResponse, canCreate: boolean, userId?: string) {
  return (
    canCreate &&
    proposal.ownerUserId === userId &&
    EDITABLE_STATUSES.has(proposal.status)
  )
}

export function ProposalFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const proposalQuery = useApiQuery(
    () => (id ? getProposal(id) : Promise.resolve(null)),
    [id],
    isEdit,
  )

  if (isEdit && proposalQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isEdit && proposalQuery.error) {
    return (
      <Card>
        <ErrorState
          title={proposalQuery.error.status === 404 ? 'Proposal not found' : 'Could not load proposal'}
          message={proposalQuery.error.message}
          onRetry={proposalQuery.reload}
        />
        <div className="flex justify-center pb-6">
          <LinkButton to="/proposals" variant="outline">
            Back to proposals
          </LinkButton>
        </div>
      </Card>
    )
  }

  if (isEdit && !proposalQuery.data) {
    return (
      <Card>
        <ErrorState
          title="Proposal not found"
          message="It may not exist, or you may not have access to it."
        />
      </Card>
    )
  }

  return <ProposalFormLayout proposal={proposalQuery.data ?? undefined} />
}

function ProposalFormLayout({ proposal }: { proposal?: ProposalResponse }) {
  const { user, can } = useAuth()
  const isEdit = Boolean(proposal)

  if (
    proposal &&
    !canEditProposal(proposal, can('PROPOSAL_CREATE'), user?.id)
  ) {
    return (
      <>
        <PageHeader
          eyebrow="Module 2 · Consultant proposals"
          title="This proposal cannot be edited"
          description="Only the owner can edit a draft or a proposal that has a clarification request."
        />
        <Card className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-700">
              <AlertTriangle aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-navy-900">
                Editing is not available
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                This proposal is {proposal.status.toLowerCase().replaceAll('_', ' ')}, or it
                belongs to another user. The backend enforces the same rule.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton to={`/proposals/${proposal.id}`}>View proposal</LinkButton>
                <LinkButton to="/proposals" variant="outline">
                  Back to proposals
                </LinkButton>
              </div>
            </div>
          </div>
        </Card>
      </>
    )
  }

  return <ProposalForm proposal={proposal} isEdit={isEdit} />
}

function ProposalForm({ proposal, isEdit }: { proposal?: ProposalResponse; isEdit: boolean }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<ProposalResponse>()
  const refs = useReferenceNames()
  const formRef = useRef<HTMLFormElement>(null)

  const [values, setValues] = useState<ProposalFormValues>(() =>
    proposal ? proposalToFormValues(proposal) : emptyProposalForm(),
  )
  const [clientErrors, setClientErrors] = useState<ProposalFormErrors>({})
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
    (district) =>
      district.status === 'ACTIVE' || district.id === values.districtId,
  )
  const currentDepartment = refs.departments.find(
    (department) => department.id === values.departmentId,
  )
  const departmentOptions = refs.departments.filter(
    (department) =>
      department.status === 'ACTIVE' || department.id === values.departmentId,
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

  const noDistricts = refs.enabled && !refs.isLoading && districtOptions.length === 0
  const villagesLoading =
    villageLoad.districtId === values.districtId && villageLoad.isLoading

  const serverError = mutation.error
  const showTopError =
    serverError !== null &&
    (serverError.fieldErrors.length === 0 || serverError.status !== 400)

  function fieldError(field: keyof ProposalFormValues): string | undefined {
    return serverFieldError(serverError, field) ?? clientErrors[field]
  }

  function updateValue<K extends keyof ProposalFormValues>(
    key: K,
    value: ProposalFormValues[K],
  ) {
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
    setClientErrors((current) => ({
      ...current,
      districtId: undefined,
      talukaId: undefined,
      villageIds: undefined,
    }))
  }

  function handleDistrictChange(nextDistrictId: string) {
    if (nextDistrictId === values.districtId) {
      return
    }
    if (values.villageIds.length > 0) {
      setPendingDistrictId(nextDistrictId)
      return
    }
    applyDistrict(nextDistrictId)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors = validateProposalForm(values)
    setClientErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus()
      }, 0)
      return
    }

    if (!isProjectType(values.projectType)) {
      return
    }

    const request = toProposalRequest({ ...values, projectType: values.projectType })

    try {
      const saved = proposal
        ? await mutation.mutate(() => updateProposal(proposal.id, request))
        : await mutation.mutate(() => createProposal(request))

      dispatch(
        addToast({
          variant: 'success',
          message: proposal ? 'Draft updated.' : 'Draft created.',
        }),
      )
      navigate(`/proposals/${saved.id}`)
    } catch {
      // The mutation hook keeps the error; the form stays filled in.
    }
  }

  if (refs.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Card className="flex min-h-48 items-center justify-center p-6 text-sm text-slate-600">
          <Spinner label="Loading districts and departments" />
          <span className="ml-2">Loading districts and departments…</span>
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
        eyebrow="Module 2 · Consultant proposals"
        title={isEdit ? 'Edit proposal' : 'New proposal'}
        description="Save a draft first. The proposal number is assigned when you submit it for scrutiny."
        actions={
          proposal ? (
            <LinkButton to={`/proposals/${proposal.id}`} variant="outline">
              Cancel
            </LinkButton>
          ) : (
            <LinkButton to="/proposals" variant="outline">
              Cancel
            </LinkButton>
          )
        }
      />

      {noDistricts ? (
        <Alert variant="warning" title="No districts are assigned to your account" className="mb-4">
          Ask an administrator to assign a district scope. You cannot create a proposal without
          one.
        </Alert>
      ) : null}

      {showTopError && serverError ? (
        <Alert variant="error" title="The proposal was not saved" className="mb-4">
          {serverError.message}
        </Alert>
      ) : null}

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Card className="p-5">
          <CardHeader
            title="Basic information"
            description="What the project is and which department proposes it."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Title"
              required
              value={values.title}
              onChange={(event) => updateValue('title', event.target.value)}
              maxLength={PROPOSAL_LIMITS.title}
              error={fieldError('title')}
              containerClassName="md:col-span-2"
              hint={`${values.title.length}/${PROPOSAL_LIMITS.title} characters`}
            />

            <Select
              label="Project type"
              required
              value={values.projectType}
              onChange={(event) => {
                updateValue('projectType', event.target.value as ProposalFormValues['projectType'])
              }}
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
              hint={
                currentDepartment && currentDepartment.status !== 'ACTIVE'
                  ? 'The currently selected department is inactive. Choose an active department before saving.'
                  : undefined
              }
            >
              <option value="">Select a department</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                  {department.status !== 'ACTIVE' ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            title="Location"
            description="The state is derived from the district by the server."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Select
              label="District"
              required
              value={values.districtId}
              onChange={(event) => handleDistrictChange(event.target.value)}
              error={fieldError('districtId')}
              hint="Only districts in your assigned scope are listed."
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
              label="Taluka (optional)"
              value={values.talukaId}
              onChange={(event) => updateValue('talukaId', event.target.value)}
              error={fieldError('talukaId')}
              disabled={!values.districtId || villagesLoading}
              hint="Changing the district clears the taluka and village selection."
            >
              <option value="">No specific taluka</option>
              {talukas.map((taluka) => (
                <option key={taluka.id} value={taluka.id}>
                  {taluka.name}
                  {taluka.status !== 'ACTIVE' ? ' (inactive)' : ''}
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
            description="Area is measured in hectares. A map alignment arrives with the GIS module."
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
              hint="1 hectare = 10,000 m²"
            />

            <Input
              label="Alignment description (optional)"
              value={values.alignmentDescription}
              onChange={(event) => updateValue('alignmentDescription', event.target.value)}
              maxLength={PROPOSAL_LIMITS.alignmentDescription}
              error={fieldError('alignmentDescription')}
              hint={`${values.alignmentDescription.length}/${PROPOSAL_LIMITS.alignmentDescription} characters`}
              containerClassName="md:col-span-2"
            />

            <Textarea
              label="Description"
              required
              value={values.description}
              onChange={(event) => updateValue('description', event.target.value)}
              maxLength={PROPOSAL_LIMITS.description}
              error={fieldError('description')}
              hint={`${values.description.length}/${PROPOSAL_LIMITS.description} characters`}
              containerClassName="md:col-span-2"
              rows={5}
            />
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Timeline" description="The planned end date must be after the start date." />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Planned start date"
              type="date"
              required
              value={values.plannedStartDate}
              onChange={(event) => updateValue('plannedStartDate', event.target.value)}
              error={fieldError('plannedStartDate')}
            />
            <Input
              label="Planned end date"
              type="date"
              required
              min={values.plannedStartDate || undefined}
              value={values.plannedEndDate}
              onChange={(event) => updateValue('plannedEndDate', event.target.value)}
              error={fieldError('plannedEndDate')}
            />
          </div>
          {values.estimatedLandAreaHa.trim() && Number(values.estimatedLandAreaHa) > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Estimated land area: {formatNumber(Number(values.estimatedLandAreaHa))} ha
            </p>
          ) : null}
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-card backdrop-blur">
          <p className="text-xs text-slate-500">
            The server validates the same limits. Unsaved changes are lost if you leave this page.
          </p>
          <div className="flex gap-2">
            <LinkButton
              to={proposal ? `/proposals/${proposal.id}` : '/proposals'}
              variant="outline"
            >
              Cancel
            </LinkButton>
            <Button
              type="submit"
              isLoading={mutation.isLoading}
              disabled={mutation.isLoading || noDistricts}
            >
              Save draft
            </Button>
          </div>
        </div>
      </form>

      {pendingDistrictId ? (
        <ConfirmDialog
          title="Change district?"
          message="Changing the district clears the selected taluka and villages. Continue?"
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
