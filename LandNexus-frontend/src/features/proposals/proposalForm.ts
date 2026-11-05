import type { ApiErrorInfo } from '../../api/errors'
import {
  LINEAR_PROJECT_TYPES,
  type ProjectType,
  type ProposalRequest,
  type ProposalResponse,
} from '../../api/types'

export const PROPOSAL_LIMITS = {
  title: 200,
  alignmentDescription: 1_000,
  description: 2_000,
  villages: 500,
  lengthIntegerDigits: 8,
  areaIntegerDigits: 10,
  decimalPlaces: 2,
} as const

export interface ProposalFormValues {
  title: string
  projectType: ProjectType | ''
  districtId: string
  talukaId: string
  departmentId: string
  lengthKm: string
  estimatedLandAreaHa: string
  villageIds: string[]
  alignmentDescription: string
  description: string
  plannedStartDate: string
  plannedEndDate: string
}

export type ProposalFormErrors = Partial<Record<keyof ProposalFormValues, string>>

export const FIELD_LABELS: Record<keyof ProposalFormValues, string> = {
  title: 'Title',
  projectType: 'Project type',
  districtId: 'District',
  talukaId: 'Taluka',
  departmentId: 'Department',
  lengthKm: 'Length (km)',
  estimatedLandAreaHa: 'Estimated land area (ha)',
  villageIds: 'Villages',
  alignmentDescription: 'Alignment description',
  description: 'Description',
  plannedStartDate: 'Planned start date',
  plannedEndDate: 'Planned end date',
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const LENGTH_PATTERN = /^\d{1,8}(\.\d{1,2})?$/
const AREA_PATTERN = /^\d{1,10}(\.\d{1,2})?$/

export function emptyProposalForm(): ProposalFormValues {
  return {
    title: '',
    projectType: '',
    districtId: '',
    talukaId: '',
    departmentId: '',
    lengthKm: '',
    estimatedLandAreaHa: '',
    villageIds: [],
    alignmentDescription: '',
    description: '',
    plannedStartDate: '',
    plannedEndDate: '',
  }
}

export function proposalToFormValues(proposal: ProposalResponse): ProposalFormValues {
  return {
    title: proposal.title,
    projectType: proposal.projectType,
    districtId: proposal.districtId,
    talukaId: proposal.talukaId ?? '',
    departmentId: proposal.departmentId,
    lengthKm: proposal.lengthKm === null ? '' : String(proposal.lengthKm),
    estimatedLandAreaHa: String(proposal.estimatedLandAreaHa),
    villageIds: [...proposal.villageIds],
    alignmentDescription: proposal.alignmentDescription ?? '',
    description: proposal.description,
    plannedStartDate: proposal.plannedStartDate,
    plannedEndDate: proposal.plannedEndDate,
  }
}

export function isLinearProjectType(projectType: ProjectType | ''): boolean {
  return projectType !== '' && LINEAR_PROJECT_TYPES.includes(projectType)
}

function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isPositiveDecimal(value: string, pattern: RegExp): boolean {
  const trimmed = value.trim()
  if (!pattern.test(trimmed)) {
    return false
  }
  return Number(trimmed) > 0
}

/**
 * Mirrors the backend limits in section 5.7. The backend remains the authority;
 * this only saves a round trip and puts the message next to the field.
 */
export function validateProposalForm(values: ProposalFormValues): ProposalFormErrors {
  const errors: ProposalFormErrors = {}
  const title = values.title.trim()
  const description = values.description.trim()
  const alignment = values.alignmentDescription.trim()

  if (!title) {
    errors.title = 'Title is required.'
  } else if (title.length > PROPOSAL_LIMITS.title) {
    errors.title = `Title must be at most ${PROPOSAL_LIMITS.title} characters.`
  }

  if (!values.projectType) {
    errors.projectType = 'Select a project type.'
  }

  if (!values.districtId) {
    errors.districtId = 'Select a district.'
  }

  if (!values.departmentId) {
    errors.departmentId = 'Select a department.'
  }

  const length = values.lengthKm.trim()
  if (isLinearProjectType(values.projectType)) {
    if (!length) {
      errors.lengthKm = 'Length is required for roads, expressways and railways.'
    } else if (!isPositiveDecimal(length, LENGTH_PATTERN)) {
      errors.lengthKm = 'Enter a length greater than 0 with at most 2 decimals.'
    }
  } else if (length && !isPositiveDecimal(length, LENGTH_PATTERN)) {
    errors.lengthKm = 'Enter a length greater than 0 with at most 2 decimals.'
  }

  const area = values.estimatedLandAreaHa.trim()
  if (!area) {
    errors.estimatedLandAreaHa = 'Estimated land area is required.'
  } else if (!isPositiveDecimal(area, AREA_PATTERN)) {
    errors.estimatedLandAreaHa =
      'Enter an area greater than 0 with at most 2 decimals.'
  }

  if (values.villageIds.length === 0) {
    errors.villageIds = 'Select at least one village.'
  } else if (values.villageIds.length > PROPOSAL_LIMITS.villages) {
    errors.villageIds = `Select at most ${PROPOSAL_LIMITS.villages} villages.`
  }

  if (alignment.length > PROPOSAL_LIMITS.alignmentDescription) {
    errors.alignmentDescription = `Alignment description must be at most ${PROPOSAL_LIMITS.alignmentDescription} characters.`
  }

  if (!description) {
    errors.description = 'Description is required.'
  } else if (description.length > PROPOSAL_LIMITS.description) {
    errors.description = `Description must be at most ${PROPOSAL_LIMITS.description} characters.`
  }

  if (!values.plannedStartDate) {
    errors.plannedStartDate = 'Select a planned start date.'
  } else if (!isValidIsoDate(values.plannedStartDate)) {
    errors.plannedStartDate = 'Enter a valid start date.'
  }

  if (!values.plannedEndDate) {
    errors.plannedEndDate = 'Select a planned end date.'
  } else if (!isValidIsoDate(values.plannedEndDate)) {
    errors.plannedEndDate = 'Enter a valid end date.'
  } else if (
    values.plannedStartDate &&
    isValidIsoDate(values.plannedStartDate) &&
    values.plannedEndDate <= values.plannedStartDate
  ) {
    errors.plannedEndDate = 'End date must be after the start date.'
  }

  return errors
}

export function toProposalRequest(
  values: ProposalFormValues & { projectType: ProjectType },
): ProposalRequest {
  return {
    title: values.title.trim(),
    projectType: values.projectType,
    districtId: values.districtId,
    talukaId: values.talukaId || null,
    departmentId: values.departmentId,
    lengthKm: values.lengthKm.trim() ? Number(values.lengthKm.trim()) : null,
    estimatedLandAreaHa: Number(values.estimatedLandAreaHa.trim()),
    villageIds: [...values.villageIds],
    alignmentDescription: values.alignmentDescription.trim() || null,
    description: values.description.trim(),
    plannedStartDate: values.plannedStartDate,
    plannedEndDate: values.plannedEndDate,
  }
}

/**
 * Finds a server field error by exact name or by a nested prefix such as
 * `villageIds[0]`, so the message still appears next to the right field.
 */
export function serverFieldError(
  info: ApiErrorInfo | null,
  field: keyof ProposalFormValues,
): string | undefined {
  if (!info) {
    return undefined
  }
  return info.fieldErrors.find(
    (entry) =>
      entry.field === field ||
      entry.field.startsWith(`${field}.`) ||
      entry.field.startsWith(`${field}[`),
  )?.message
}
