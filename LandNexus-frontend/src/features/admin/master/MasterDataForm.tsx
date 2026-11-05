import { useId, useState, type FormEvent } from 'react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import {
  createMaster,
  updateMaster,
  type MasterRecord,
  type MasterParentOption,
} from '../../../api/administration'
import { getFieldError } from '../../../api/errors'
import type { DivisionResponse } from '../../../api/types'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Select } from '../../../components/ui/Select'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { useApiQuery } from '../../../hooks/useApiQuery'
import type { MasterResourceConfig } from './masterDataConfig'
import {
  buildMasterRequest,
  DEPARTMENT_LEVEL_LABELS,
  DEPARTMENT_LEVELS,
  emptyMasterForm,
  loadAllMasterRecords,
  MASTER_CODE_MAX,
  MASTER_NAME_MAX,
  masterServerField,
  masterToFormValues,
  validateMasterForm,
  type MasterFormErrors,
  type MasterFormValues,
} from './masterDataConfig'

interface MasterDataFormProps {
  config: MasterResourceConfig
  record?: MasterRecord
  parentOptions: MasterParentOption[]
  parentOptionsLoading: boolean
  parentOptionsError: string | null
  onClose: () => void
  onSaved: () => void
}

export function MasterDataForm({
  config,
  record,
  parentOptions,
  parentOptionsLoading,
  parentOptionsError,
  onClose,
  onSaved,
}: MasterDataFormProps) {
  const dispatch = useAppDispatch()
  const formId = useId()
  const mutation = useApiMutation<MasterRecord>()
  const [values, setValues] = useState<MasterFormValues>(() =>
    record ? masterToFormValues(record) : emptyMasterForm(),
  )
  const [clientErrors, setClientErrors] = useState<MasterFormErrors>({})

  const isEdit = Boolean(record)
  const serverError = mutation.error

  const parentSelectLoading = parentOptionsLoading
  const divisionQuery = useApiQuery(
    () => loadAllMasterRecords('divisions'),
    [config.key],
    Boolean(config.hasOptionalDivision && values.parentId),
  )
  const divisionOptions = (divisionQuery.data ?? []).filter(
    (division) =>
      division.stateId === values.parentId &&
      (division.status === 'ACTIVE' || division.id === values.divisionId),
  )

  const activeParentOptions = parentOptions.filter(
    (option) => option.status === 'ACTIVE' || option.id === values.parentId,
  )
  const showCurrentParentFallback =
    Boolean(record) &&
    Boolean(config.parent) &&
    Boolean(values.parentId) &&
    !activeParentOptions.some((option) => option.id === values.parentId)

  const parentUnavailable =
    Boolean(config.parent) && !parentSelectLoading && activeParentOptions.length === 0
  const divisionHint = values.parentId
    ? 'Optional. Only divisions of the selected state are listed.'
    : 'Select a state first.'

  function updateValue<K extends keyof MasterFormValues>(
    key: K,
    value: MasterFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
    setClientErrors((current) => ({ ...current, [key]: undefined }))
  }

  function updateParent(next: string) {
    setValues((current) => ({
      ...current,
      parentId: next,
      divisionId: config.hasOptionalDivision ? '' : current.divisionId,
    }))
    setClientErrors((current) => ({ ...current, parentId: undefined }))
  }

  function fieldError(field: keyof MasterFormValues): string | undefined {
    const serverField = masterServerField(config, field)
    return (
      (serverError ? getFieldError(serverError, serverField) : undefined) ??
      clientErrors[field]
    )
  }

  const showTopError =
    serverError !== null &&
    (serverError.fieldErrors.length === 0 || serverError.status !== 400)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors = validateMasterForm(config, values)
    setClientErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => {
        document
          .getElementById(formId)
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus()
      }, 0)
      return
    }

    const request = buildMasterRequest(config.key, values)

    try {
      if (record) {
        await mutation.mutate(() => updateMaster(config.key, record.id, request))
      } else {
        await mutation.mutate(() => createMaster(config.key, request))
      }
      dispatch(
        addToast({
          variant: 'success',
          message: `${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} ${
            isEdit ? 'updated' : 'created'
          }.`,
        }),
      )
      onSaved()
    } catch {
      // The mutation hook keeps the error; the form stays filled in.
    }
  }

  return (
    <Modal
      title={`${isEdit ? 'Edit' : 'New'} ${config.singular}`}
      description={
        isEdit
          ? 'Changes are checked again by the backend. Activate or deactivate from the list.'
          : `Create a new ${config.singular}. The backend checks that the code is unique.`
      }
      onClose={() => {
        if (!mutation.isLoading) {
          onClose()
        }
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            isLoading={mutation.isLoading}
            disabled={!isEdit && parentUnavailable}
          >
            {isEdit ? 'Save changes' : `Create ${config.singular}`}
          </Button>
        </>
      }
    >
      {parentOptionsError ? (
        <Alert variant="warning" title="Parent list unavailable" className="mb-4">
          {parentOptionsError}
          {isEdit
            ? ' You can still save the other fields; the current parent is kept unchanged.'
            : ' You cannot create a record until this list is available.'}
        </Alert>
      ) : null}

      {showTopError && serverError ? (
        <Alert variant="error" title={`The ${config.singular} was not saved`} className="mb-4">
          {serverError.message}
        </Alert>
      ) : null}

      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Code"
            required
            value={values.code}
            onChange={(event) => updateValue('code', event.target.value)}
            maxLength={MASTER_CODE_MAX}
            error={fieldError('code')}
            hint={`${values.code.length}/${MASTER_CODE_MAX} characters · stored in upper case`}
          />
          <Input
            label="Name"
            required
            value={values.name}
            onChange={(event) => updateValue('name', event.target.value)}
            maxLength={MASTER_NAME_MAX}
            error={fieldError('name')}
            hint={`${values.name.length}/${MASTER_NAME_MAX} characters`}
          />
        </div>

        {config.parent ? (
          <Select
            label={config.parent.label}
            required={config.parent.required}
            value={values.parentId}
            onChange={(event) => updateParent(event.target.value)}
            disabled={parentSelectLoading}
            error={fieldError('parentId')}
            hint={parentSelectLoading ? 'Loading parent records…' : config.parent.hint}
          >
            <option value="">Select a {config.parent.label.toLowerCase()}</option>
            {showCurrentParentFallback ? (
              <option value={values.parentId}>
                Current {config.parent.label.toLowerCase()} (selected)
              </option>
            ) : null}
            {activeParentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.status !== 'ACTIVE' ? ' (inactive)' : ''}
              </option>
            ))}
          </Select>
        ) : null}

        {config.hasLevel ? (
          <Select
            label="Department level"
            required
            value={values.level}
            onChange={(event) =>
              updateValue('level', event.target.value as MasterFormValues['level'])
            }
            error={fieldError('level')}
            hint="Where this department operates."
          >
            <option value="">Select a level</option>
            {DEPARTMENT_LEVELS.map((level) => (
              <option key={level} value={level}>
                {DEPARTMENT_LEVEL_LABELS[level]}
              </option>
            ))}
          </Select>
        ) : null}

        {config.hasOptionalDivision ? (
          <Select
            label="Division (optional)"
            value={values.divisionId}
            onChange={(event) => updateValue('divisionId', event.target.value)}
            disabled={!values.parentId || divisionQuery.isLoading}
            error={fieldError('divisionId')}
            hint={
              divisionQuery.isLoading
                ? 'Loading divisions…'
                : divisionQuery.error?.message ?? divisionHint
            }
          >
            <option value="">No division</option>
            {divisionOptions.map((division: DivisionResponse) => (
              <option key={division.id} value={division.id}>
                {division.name}
                {division.status !== 'ACTIVE' ? ' (inactive)' : ''}
              </option>
            ))}
          </Select>
        ) : null}
      </form>
    </Modal>
  )
}
