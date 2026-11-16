import { apiClient } from './client'
import type {
  AssetRequest,
  AssetResponse,
  BenefitTypeRequest,
  BenefitTypeResponse,
  CompensationSummary,
  EntitlementRequest,
  PageResponse,
  PaymentEventResponse,
  PaymentResponse,
  PaymentStatus,
  PaymentSummary,
  RateRequest,
  RateResponse,
  RateStatus,
  RrCaseRequest,
  RrCaseResponse,
  RuleSetRequest,
  RuleSetResponse,
  RuleSetStatus,
  ValuationResponse,
} from './types'

/* ------------------------------------------------------------------ */
/* Rate cards                                                          */
/* ------------------------------------------------------------------ */

export interface RateListParams {
  villageId?: string
  status?: RateStatus
  page?: number
  size?: number
}

export async function getRates({
  villageId,
  status,
  page = 0,
  size = 20,
}: RateListParams = {}): Promise<PageResponse<RateResponse>> {
  const { data } = await apiClient.get<PageResponse<RateResponse>>('/compensation/rates', {
    params: {
      villageId: villageId || undefined,
      status: status || undefined,
      page,
      size,
    },
  })
  return data
}

export async function createRate(request: RateRequest): Promise<RateResponse> {
  const { data } = await apiClient.post<RateResponse>('/compensation/rates', {
    ...request,
    sourceNote: request.sourceNote?.trim() || null,
  })
  return data
}

export async function approveRate(
  id: string,
  remarks?: string,
): Promise<RateResponse> {
  const trimmed = remarks?.trim()
  const { data } = await apiClient.post<RateResponse>(
    `/compensation/rates/${id}/approve`,
    trimmed ? { remarks: trimmed } : undefined,
  )
  return data
}

/** Rejecting a rate requires remarks; the backend enforces the same rule. */
export async function rejectRate(id: string, remarks: string): Promise<RateResponse> {
  const { data } = await apiClient.post<RateResponse>(
    `/compensation/rates/${id}/reject`,
    { remarks: remarks.trim() },
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Rule sets                                                           */
/* ------------------------------------------------------------------ */

export interface RuleSetListParams {
  status?: RuleSetStatus
  page?: number
  size?: number
}

export async function getRuleSets({
  status,
  page = 0,
  size = 20,
}: RuleSetListParams = {}): Promise<PageResponse<RuleSetResponse>> {
  const { data } = await apiClient.get<PageResponse<RuleSetResponse>>(
    '/compensation/rule-sets',
    {
      params: {
        status: status || undefined,
        page,
        size,
      },
    },
  )
  return data
}

export async function getRuleSet(id: string): Promise<RuleSetResponse> {
  const { data } = await apiClient.get<RuleSetResponse>(`/compensation/rule-sets/${id}`)
  return data
}

export async function createRuleSet(request: RuleSetRequest): Promise<RuleSetResponse> {
  const { data } = await apiClient.post<RuleSetResponse>('/compensation/rule-sets', {
    ...request,
    stateId: request.stateId || null,
    districtId: request.districtId || null,
    effectiveTo: request.effectiveTo || null,
    description: request.description?.trim() || null,
    components: request.components.map((component) => ({
      code: component.code.trim(),
      name: component.name.trim(),
      type: component.type,
      factor: component.factor ?? null,
      baseCodes: component.type === 'PERCENT_OF' ? (component.baseCodes ?? []) : null,
    })),
  })
  return data
}

export async function approveRuleSet(id: string): Promise<RuleSetResponse> {
  const { data } = await apiClient.post<RuleSetResponse>(
    `/compensation/rule-sets/${id}/approve`,
  )
  return data
}

/** Retiring a rule set requires remarks; the backend enforces the same rule. */
export async function retireRuleSet(
  id: string,
  remarks: string,
): Promise<RuleSetResponse> {
  const { data } = await apiClient.post<RuleSetResponse>(
    `/compensation/rule-sets/${id}/retire`,
    { remarks: remarks.trim() },
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Assets and estimates                                                */
/* ------------------------------------------------------------------ */

export async function getAssets(
  caseId: string,
  caseParcelId: string,
): Promise<AssetResponse[]> {
  const { data } = await apiClient.get<AssetResponse[]>(
    `/compensation/cases/${caseId}/parcels/${caseParcelId}/assets`,
  )
  return data
}

export async function addAsset(
  caseId: string,
  caseParcelId: string,
  request: AssetRequest,
): Promise<AssetResponse> {
  const { data } = await apiClient.post<AssetResponse>(
    `/compensation/cases/${caseId}/parcels/${caseParcelId}/assets`,
    { ...request, description: request.description.trim(), unit: request.unit.trim() },
  )
  return data
}

export async function voidAsset(
  caseId: string,
  assetId: string,
  reason: string,
): Promise<AssetResponse> {
  const { data } = await apiClient.post<AssetResponse>(
    `/compensation/cases/${caseId}/assets/${assetId}/void`,
    { reason: reason.trim() },
  )
  return data
}

export async function getValuations(caseId: string): Promise<ValuationResponse[]> {
  const { data } = await apiClient.get<ValuationResponse[]>(
    `/compensation/cases/${caseId}/valuations`,
  )
  return data
}

export async function getValuation(id: string): Promise<ValuationResponse> {
  const { data } = await apiClient.get<ValuationResponse>(`/compensation/valuations/${id}`)
  return data
}

/** Computes or recomputes a draft estimate from approved rates and rule sets. */
export async function computeValuation(
  caseId: string,
  caseParcelId: string,
): Promise<ValuationResponse> {
  const { data } = await apiClient.post<ValuationResponse>(
    `/compensation/cases/${caseId}/parcels/${caseParcelId}/valuations`,
  )
  return data
}

export async function submitValuation(id: string): Promise<ValuationResponse> {
  const { data } = await apiClient.post<ValuationResponse>(
    `/compensation/valuations/${id}/submit`,
  )
  return data
}

export async function approveValuation(
  id: string,
  remarks?: string,
): Promise<ValuationResponse> {
  const trimmed = remarks?.trim()
  const { data } = await apiClient.post<ValuationResponse>(
    `/compensation/valuations/${id}/approve`,
    trimmed ? { remarks: trimmed } : undefined,
  )
  return data
}

/** Rejecting an estimate requires remarks; the backend enforces the same rule. */
export async function rejectValuation(
  id: string,
  remarks: string,
): Promise<ValuationResponse> {
  const { data } = await apiClient.post<ValuationResponse>(
    `/compensation/valuations/${id}/reject`,
    { remarks: remarks.trim() },
  )
  return data
}

export async function getCompensationSummary(
  caseId: string,
): Promise<CompensationSummary> {
  const { data } = await apiClient.get<CompensationSummary>(
    `/compensation/cases/${caseId}/compensation-summary`,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* SIMULATED payments                                                  */
/* ------------------------------------------------------------------ */

/** One payment per owner, split by the ownership snapshot. Once per estimate. */
export type SimulatedPaymentChannel = 'PFMS_SIMULATED' | 'DBT_SIMULATED' | 'OTHER_SIMULATED'

export async function generatePayments(
  valuationId: string,
  paymentChannel: SimulatedPaymentChannel = 'OTHER_SIMULATED',
): Promise<PaymentResponse[]> {
  const { data } = await apiClient.post<PaymentResponse[]>(
    `/compensation/valuations/${valuationId}/payments`,
    { paymentChannel },
  )
  return data
}

export async function getPayments(caseId: string): Promise<PaymentResponse[]> {
  const { data } = await apiClient.get<PaymentResponse[]>(
    `/compensation/cases/${caseId}/payments`,
  )
  return data
}

export async function getPaymentSummary(caseId: string): Promise<PaymentSummary> {
  const { data } = await apiClient.get<PaymentSummary>(
    `/compensation/cases/${caseId}/payment-summary`,
  )
  return data
}

export async function getPaymentEvents(paymentId: string): Promise<PaymentEventResponse[]> {
  const { data } = await apiClient.get<PaymentEventResponse[]>(
    `/compensation/payments/${paymentId}/events`,
  )
  return data
}

/** Downloads a no-store DEMO receipt for the simulated payment record. */
export async function downloadPaymentReceipt(paymentId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `/compensation/payments/${paymentId}/receipt`,
    { responseType: 'blob' },
  )
  return data
}

/** Releases a payment in the simulation, and retries a failed one. */
export async function releasePayment(id: string): Promise<PaymentResponse> {
  const { data } = await apiClient.post<PaymentResponse>(
    `/compensation/payments/${id}/release`,
  )
  return data
}

/** Records the simulated gateway answer. A FAILED outcome requires a reason. */
export async function simulatePayment(
  id: string,
  outcome: Extract<PaymentStatus, 'CONFIRMED' | 'FAILED'>,
  reason?: string,
): Promise<PaymentResponse> {
  const trimmed = reason?.trim()
  const { data } = await apiClient.post<PaymentResponse>(
    `/compensation/payments/${id}/simulate-response`,
    { outcome, reason: trimmed || null },
  )
  return data
}

/* ------------------------------------------------------------------ */
/* R&R                                                                 */
/* ------------------------------------------------------------------ */

export async function getBenefitTypes(): Promise<BenefitTypeResponse[]> {
  const { data } = await apiClient.get<BenefitTypeResponse[]>(
    '/compensation/rr/benefit-types',
  )
  return data
}

export async function createBenefitType(
  request: BenefitTypeRequest,
): Promise<BenefitTypeResponse> {
  const { data } = await apiClient.post<BenefitTypeResponse>(
    '/compensation/rr/benefit-types',
    {
      ...request,
      code: request.code.trim(),
      name: request.name.trim(),
      defaultAmount: request.defaultAmount ?? null,
      defaultMonths: request.defaultMonths ?? null,
      requiresDisplaced: request.requiresDisplaced ?? false,
      requiresLivelihoodLost: request.requiresLivelihoodLost ?? false,
    },
  )
  return data
}

export async function getRrCases(caseId: string): Promise<RrCaseResponse[]> {
  const { data } = await apiClient.get<RrCaseResponse[]>(
    `/compensation/cases/${caseId}/rr-cases`,
  )
  return data
}

export async function identifyRrCase(
  caseId: string,
  request: RrCaseRequest,
): Promise<RrCaseResponse> {
  const { data } = await apiClient.post<RrCaseResponse>(
    `/compensation/cases/${caseId}/rr-cases`,
    {
      landownerId: request.landownerId,
      displaced: request.displaced,
      livelihoodLost: request.livelihoodLost,
      notes: request.notes?.trim() || null,
    },
  )
  return data
}

export async function getRrCase(id: string): Promise<RrCaseResponse> {
  const { data } = await apiClient.get<RrCaseResponse>(`/compensation/rr-cases/${id}`)
  return data
}

export async function addEntitlement(
  rrCaseId: string,
  request: EntitlementRequest,
): Promise<RrCaseResponse> {
  const { data } = await apiClient.post<RrCaseResponse>(
    `/compensation/rr-cases/${rrCaseId}/entitlements`,
    {
      benefitTypeId: request.benefitTypeId,
      amount: request.amount ?? null,
      months: request.months ?? null,
    },
  )
  return data
}

export async function approveRrCase(id: string): Promise<RrCaseResponse> {
  const { data } = await apiClient.post<RrCaseResponse>(
    `/compensation/rr-cases/${id}/approve`,
  )
  return data
}

export async function deliverEntitlement(
  rrCaseId: string,
  entitlementId: string,
  request: { deliveredOn: string; remarks?: string | null },
): Promise<RrCaseResponse> {
  const { data } = await apiClient.post<RrCaseResponse>(
    `/compensation/rr-cases/${rrCaseId}/entitlements/${entitlementId}/deliver`,
    { deliveredOn: request.deliveredOn, remarks: request.remarks?.trim() || null },
  )
  return data
}

export async function completeRrCase(id: string): Promise<RrCaseResponse> {
  const { data } = await apiClient.post<RrCaseResponse>(
    `/compensation/rr-cases/${id}/complete`,
  )
  return data
}
