import { apiClient } from './client'
import type {
  Dashboard,
  EscalationPage,
  ForecastOverview,
  NlamsDashboard,
  ReportInfo,
  ReportResult,
  ScanResult,
  Settings,
  SlaItemType,
  SlaOverview,
  SlaRule,
  SlaRuleRequest,
} from './types'
import { filenameFromContentDisposition } from '../utils/download'

export interface ScopeFilter {
  stateId?: string
  districtId?: string
}

/* ------------------------------------------------------------------ */
/* Dashboards                                                          */
/* ------------------------------------------------------------------ */

export async function getDashboard({
  stateId,
  districtId,
}: ScopeFilter = {}): Promise<Dashboard> {
  const { data } = await apiClient.get<Dashboard>('/monitoring/dashboard', {
    params: {
      stateId: stateId || undefined,
      districtId: districtId || undefined,
    },
  })
  return data
}

/** Real-time NLAMS progress. The page polls this while its tab is visible. */
export async function getNlams({
  stateId,
  districtId,
}: ScopeFilter = {}): Promise<NlamsDashboard> {
  const { data } = await apiClient.get<NlamsDashboard>('/monitoring/nlams', {
    params: {
      stateId: stateId || undefined,
      districtId: districtId || undefined,
    },
  })
  return data
}

/* ------------------------------------------------------------------ */
/* MIS reports                                                         */
/* ------------------------------------------------------------------ */

export async function getReportCatalogue(): Promise<ReportInfo[]> {
  const { data } = await apiClient.get<ReportInfo[]>('/monitoring/reports')
  return data
}

export interface ReportRunParams extends ScopeFilter {
  status?: string
  page?: number
  size?: number
}

export async function runReport(
  code: string,
  { status, stateId, districtId, page = 0, size = 50 }: ReportRunParams = {},
): Promise<ReportResult> {
  const { data } = await apiClient.get<ReportResult>(`/monitoring/reports/${code}`, {
    params: {
      status: status || undefined,
      stateId: stateId || undefined,
      districtId: districtId || undefined,
      page,
      size,
    },
  })
  return data
}

/**
 * The CSV endpoint needs the Authorization header, so it is fetched as a blob
 * through the shared client. A 400 (too many rows) keeps the server message.
 */
export async function exportReportCsv(
  code: string,
  { status, stateId, districtId }: ReportRunParams = {},
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(
    `/monitoring/reports/${code}/export.csv`,
    {
      params: {
        status: status || undefined,
        stateId: stateId || undefined,
        districtId: districtId || undefined,
      },
      responseType: 'blob',
    },
  )

  return {
    blob: response.data,
    filename: filenameFromContentDisposition(
      response.headers['content-disposition'] as string | undefined,
      `${code.toLowerCase()}.csv`,
    ),
  }
}

/* ------------------------------------------------------------------ */
/* SLA monitoring                                                      */
/* ------------------------------------------------------------------ */

export async function getSlaOverview({
  stateId,
  districtId,
}: ScopeFilter = {}): Promise<SlaOverview> {
  const { data } = await apiClient.get<SlaOverview>('/monitoring/sla', {
    params: {
      stateId: stateId || undefined,
      districtId: districtId || undefined,
    },
  })
  return data
}

export async function getSlaRules(): Promise<SlaRule[]> {
  const { data } = await apiClient.get<SlaRule[]>('/monitoring/sla/rules')
  return data
}

/** A stale rowVersion gives 409; the caller reloads the row and tells the user. */
export async function updateSlaRule(
  itemType: SlaItemType,
  request: SlaRuleRequest,
): Promise<SlaRule> {
  const { data } = await apiClient.put<SlaRule>(
    `/monitoring/sla/rules/${itemType}`,
    {
      warnAfterHours: request.warnAfterHours,
      breachAfterHours: request.breachAfterHours,
      responsibleRole: request.responsibleRole,
      escalateRole: request.escalateRole || null,
      active: request.active,
      rowVersion: request.rowVersion,
    },
  )
  return data
}

export async function scanSla(districtId?: string): Promise<ScanResult> {
  const { data } = await apiClient.post<ScanResult>('/monitoring/sla/scan', undefined, {
    params: { districtId: districtId || undefined },
  })
  return data
}

export async function getEscalations({
  stateId,
  districtId,
  page = 0,
  size = 20,
}: ReportRunParams = {}): Promise<EscalationPage> {
  const { data } = await apiClient.get<EscalationPage>('/monitoring/sla/escalations', {
    params: {
      stateId: stateId || undefined,
      districtId: districtId || undefined,
      page,
      size,
    },
  })
  return data
}

/* ------------------------------------------------------------------ */
/* Timeline forecast (statistical, not machine learning)               */
/* ------------------------------------------------------------------ */

export async function getForecast({
  stateId,
  districtId,
}: ScopeFilter = {}): Promise<ForecastOverview> {
  const { data } = await apiClient.get<ForecastOverview>('/monitoring/forecast', {
    params: {
      stateId: stateId || undefined,
      districtId: districtId || undefined,
    },
  })
  return data
}

/* ------------------------------------------------------------------ */
/* Deployment settings                                                 */
/* ------------------------------------------------------------------ */

export async function getSettings(): Promise<Settings> {
  const { data } = await apiClient.get<Settings>('/monitoring/settings')
  return data
}
