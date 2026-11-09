import type { ApiErrorInfo } from '../../api/errors'
import type { LandownerRequest, LandownerResponse, OwnerType } from '../../api/types'

export interface LandownerFormValues {
  districtId: string
  ownerType: OwnerType | ''
  fullName: string
  guardianName: string
  address: string
  phone: string
}

export type LandownerFormErrors = Partial<Record<keyof LandownerFormValues, string>>

const PHONE_PATTERN = /^[0-9+\- ]{6,20}$/

export function emptyLandownerForm(): LandownerFormValues {
  return {
    districtId: '',
    ownerType: '',
    fullName: '',
    guardianName: '',
    address: '',
    phone: '',
  }
}

export function landownerToFormValues(owner: LandownerResponse): LandownerFormValues {
  return {
    districtId: owner.districtId,
    ownerType: owner.ownerType,
    fullName: owner.fullName,
    guardianName: owner.guardianName ?? '',
    address: owner.address ?? '',
    phone: owner.phone ?? '',
  }
}

export function validateLandownerForm(values: LandownerFormValues): LandownerFormErrors {
  const errors: LandownerFormErrors = {}

  if (!values.districtId) {
    errors.districtId = 'Select a district.'
  }
  if (!values.ownerType) {
    errors.ownerType = 'Select the owner type.'
  }
  if (!values.fullName.trim()) {
    errors.fullName = 'Enter the full name.'
  } else if (values.fullName.trim().length > 200) {
    errors.fullName = 'Use at most 200 characters.'
  }
  if (values.guardianName.trim().length > 200) {
    errors.guardianName = 'Use at most 200 characters.'
  }
  if (values.address.trim().length > 500) {
    errors.address = 'Use at most 500 characters.'
  }
  const phone = values.phone.trim()
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = 'Use 6 to 20 digits, spaces, plus or hyphen.'
  }

  return errors
}

export function toLandownerRequest(values: LandownerFormValues): LandownerRequest {
  return {
    districtId: values.districtId,
    ownerType: values.ownerType as OwnerType,
    fullName: values.fullName.trim(),
    guardianName: values.guardianName.trim() || null,
    address: values.address.trim() || null,
    phone: values.phone.trim() || null,
  }
}

export function serverLandownerFieldError(
  info: ApiErrorInfo | null,
  field: keyof LandownerFormValues,
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
