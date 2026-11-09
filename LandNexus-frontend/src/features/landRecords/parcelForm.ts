import type { ApiErrorInfo } from '../../api/errors'
import type {
  LandClassification,
  LandUse,
  ParcelRequest,
  ParcelResponse,
} from '../../api/types'

export interface ParcelFormValues {
  districtId: string
  talukaId: string
  villageId: string
  gatNumber: string
  surveyNumber: string
  subdivisionNumber: string
  areaHa: string
  classification: LandClassification | ''
  landUse: LandUse | ''
}

export type ParcelFormErrors = Partial<Record<keyof ParcelFormValues, string>>

export function emptyParcelForm(): ParcelFormValues {
  return {
    districtId: '',
    talukaId: '',
    villageId: '',
    gatNumber: '',
    surveyNumber: '',
    subdivisionNumber: '',
    areaHa: '',
    classification: '',
    landUse: '',
  }
}

export function parcelToFormValues(parcel: ParcelResponse): ParcelFormValues {
  return {
    districtId: parcel.districtId,
    talukaId: parcel.talukaId,
    villageId: parcel.villageId,
    gatNumber: parcel.gatNumber ?? '',
    surveyNumber: parcel.surveyNumber ?? '',
    subdivisionNumber: parcel.subdivisionNumber ?? '',
    areaHa: String(parcel.areaHa),
    classification: parcel.classification,
    landUse: parcel.landUse,
  }
}

const AREA_PATTERN = /^\d{1,8}(\.\d{1,4})?$/

export function validateParcelForm(values: ParcelFormValues): ParcelFormErrors {
  const errors: ParcelFormErrors = {}

  if (!values.villageId) {
    errors.villageId = 'Select a village.'
  }
  if (!values.gatNumber.trim() && !values.surveyNumber.trim()) {
    errors.gatNumber = 'Enter at least a Gat number or a Survey number.'
    errors.surveyNumber = 'Enter at least a Gat number or a Survey number.'
  }
  if (values.gatNumber.trim().length > 30) {
    errors.gatNumber = 'Use at most 30 characters.'
  }
  if (values.surveyNumber.trim().length > 30) {
    errors.surveyNumber = 'Use at most 30 characters.'
  }
  if (values.subdivisionNumber.trim().length > 30) {
    errors.subdivisionNumber = 'Use at most 30 characters.'
  }

  const area = values.areaHa.trim()
  if (!area) {
    errors.areaHa = 'Enter the area in hectares.'
  } else if (!AREA_PATTERN.test(area) || Number(area) <= 0) {
    errors.areaHa = 'Enter a positive area with at most four decimal places.'
  }

  if (!values.classification) {
    errors.classification = 'Select a land classification.'
  }
  if (!values.landUse) {
    errors.landUse = 'Select a land use.'
  }

  return errors
}

export function toParcelRequest(values: ParcelFormValues): ParcelRequest {
  return {
    villageId: values.villageId,
    gatNumber: values.gatNumber.trim() || null,
    surveyNumber: values.surveyNumber.trim() || null,
    subdivisionNumber: values.subdivisionNumber.trim() || null,
    areaHa: Number(values.areaHa.trim()),
    classification: values.classification as LandClassification,
    landUse: values.landUse as LandUse,
  }
}

export function serverParcelFieldError(
  info: ApiErrorInfo | null,
  field: keyof ParcelFormValues,
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
