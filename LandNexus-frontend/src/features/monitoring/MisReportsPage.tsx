import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileSpreadsheet, RefreshCw, Table2 } from 'lucide-react'
import type { ReportCode, ReportColumn } from '../../api/types'
import {
  exportReportCsv,
  getReportCatalogue,
  runReport,
} from '../../api/monitoring'
import { toApiErrorInfo } from '../../api/errors'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Select } from '../../components/ui/Select'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION } from '../../utils/permissions'
import {
  formatDate,
  formatMoney,
  formatNumber,
} from '../../utils/format'
import { saveBlob } from '../../utils/download'
import { useAuth } from '../auth/useAuth'
import { MonitoringFilters } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { REPORT_STATUS_OPTIONS } from './labels'
import { useMonitoringScope } from './scope'

type ReportRow = Record<string, string | number | null>

const EXPORT_ROW_LIMIT = 10_000

export function MisReportsPage() {
  const { can } = useAuth()
  const canRead = can(PERMISSION.REPORT_READ)
  const canExport = can(PERMISSION.REPORT_EXPORT)
  const scope = useMonitoringScope()
  const [params, setParams] = useSearchParams()
  const requestedCode = params.get('report') ?? ''
  const status = params.get('status') ?? ''
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const catalogue = useApiQuery(() => getReportCatalogue(), [], canRead)
  const catalogueCodes = (catalogue.data ?? []).map((info) => info.code)
  const activeCode: ReportCode | '' =
    requestedCode && catalogueCodes.includes(requestedCode as ReportCode)
      ? (requestedCode as ReportCode)
      : (catalogue.data?.[0]?.code ?? '')
  const activeInfo = catalogue.data?.find((info) => info.code === activeCode)
  const statusOptions = activeCode ? REPORT_STATUS_OPTIONS[activeCode] : []

  const result = useApiQuery(
    () =>
      runReport(activeCode, {
        status: status || undefined,
        stateId: scope.stateId || undefined,
        districtId: scope.districtId || undefined,
        page,
        size,
      }),
    [activeCode, status, scope.stateId, scope.districtId, page, size],
    canRead && Boolean(activeCode),
  )

  useEffect(() => {
    setPage(0)
  }, [activeCode, status, scope.stateId, scope.districtId])

  function updateParams(next: { report?: string; status?: string }) {
    setParams(
      (current) => {
        const merged = new URLSearchParams(current)
        if (next.report !== undefined) {
          if (next.report) {
            merged.set('report', next.report)
          } else {
            merged.delete('report')
          }
        }
        if (next.status !== undefined) {
          if (next.status) {
            merged.set('status', next.status)
          } else {
            merged.delete('status')
          }
        }
        return merged
      },
      { replace: true },
    )
  }

  async function handleExport() {
    if (!activeCode) {
      return
    }
    setExporting(true)
    setExportError(null)
    try {
      const { blob, filename } = await exportReportCsv(activeCode, {
        status: status || undefined,
        stateId: scope.stateId || undefined,
        districtId: scope.districtId || undefined,
      })
      saveBlob(blob, filename)
    } catch (caught) {
      setExportError(toApiErrorInfo(caught).message)
    } finally {
      setExporting(false)
    }
  }

  const columns: TableColumn<ReportRow>[] = (result.data?.columns ?? []).map(
    (column: ReportColumn) => ({
      key: column.key,
      header: column.label,
      className:
        column.type === 'NUMBER' || column.type === 'MONEY'
          ? 'text-right tabular-nums'
          : undefined,
      headerClassName:
        column.type === 'NUMBER' || column.type === 'MONEY' ? 'text-right' : undefined,
      render: (row) => formatCell(row[column.key], column.type),
    }),
  )

  const totalRows = result.data?.totalRows ?? 0
  const totalPages = Math.max(1, Math.ceil(totalRows / size))

  return (
    <div>
      <PageHeader
        eyebrow="NLAMS · Monitoring and MIS"
        title="MIS reports"
        description="Run the reports the backend exposes and export the same rows as CSV. Every export is audited by the backend."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                catalogue.reload()
                result.reload()
              }}
              isLoading={catalogue.isLoading || result.isLoading}
              leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button
              onClick={handleExport}
              isLoading={exporting}
              disabled={!canExport || !activeCode || totalRows === 0}
              leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}
            >
              Export CSV
            </Button>
          </>
        }
      />

      <MonitoringTabs />

      <MonitoringFilters scope={scope}>
        <Select
          label="Report"
          value={activeCode}
          onChange={(event) => updateParams({ report: event.target.value, status: '' })}
          disabled={catalogue.isLoading || catalogue.data?.length === 0}
        >
          {(catalogue.data ?? []).map((info) => (
            <option key={info.code} value={info.code}>
              {info.title}
            </option>
          ))}
        </Select>

        <Select
          label="Status"
          value={status}
          onChange={(event) => updateParams({ status: event.target.value })}
          disabled={statusOptions.length === 0}
        >
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </MonitoringFilters>

      {!canRead ? (
        <Alert variant="error">
          MIS reports need the report read permission. Ask an administrator for REPORT_READ.
        </Alert>
      ) : catalogue.error ? (
        <Card>
          <ErrorState message={catalogue.error.message} onRetry={catalogue.reload} />
        </Card>
      ) : catalogue.data && catalogue.data.length === 0 ? (
        <Card className="p-8">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <FileSpreadsheet aria-hidden="true" className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-navy-900">No reports available</h2>
            <p className="mt-2 text-sm text-slate-600">
              The backend returned an empty report catalogue for your role.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {!canExport ? (
            <Alert variant="info" className="mb-5">
              Your role can run reports but cannot export CSV. The backend requires the
              REPORT_EXPORT permission for exports.
            </Alert>
          ) : null}

          {exportError ? (
            <Alert variant="error" title="Export failed" className="mb-5">
              {exportError}
            </Alert>
          ) : null}

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-navy-900">
                  {activeInfo?.title ?? 'Report'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{activeInfo?.description}</p>
              </div>
              <span className="text-xs text-slate-500">
                {formatNumber(totalRows)} row(s) · exports are capped at{' '}
                {formatNumber(EXPORT_ROW_LIMIT)} rows
              </span>
            </div>

            {result.error ? (
              <ErrorState message={result.error.message} onRetry={result.reload} />
            ) : (
              <DataTable
                columns={columns}
                rows={result.data?.rows ?? []}
                rowKey={(row) =>
                  columns
                    .map((column) => String(row[column.key] ?? ''))
                    .join('|') + String(result.data?.rows.indexOf(row))
                }
                isLoading={result.isLoading}
                emptyTitle="No rows"
                emptyDescription="The report ran successfully but returned no rows for this scope and status."
                caption={activeInfo?.title ?? 'MIS report'}
                page={page}
                size={size}
                totalElements={totalRows}
                totalPages={totalPages}
                onPageChange={setPage}
                onSizeChange={(nextSize) => {
                  setSize(nextSize)
                  setPage(0)
                }}
              />
            )}
          </Card>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Table2 aria-hidden="true" className="h-5 w-5 text-slate-500" />
                <h2 className="text-base font-semibold text-navy-900">Reports available now</h2>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {(catalogue.data ?? []).map((info) => (
                  <li key={info.code}>
                    <span className="font-medium text-navy-900">{info.title}</span> —{' '}
                    {info.description}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-semibold text-navy-900">
                Reports not exposed by the backend
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>
                  A standalone district-wise report: use the district filter on the Projects,
                  Acquisition cases and Compensation reports instead.
                </li>
                <li>
                  A stage-duration report: the backend exposes current status counts and SLA item
                  ages, not the time spent in each stage.
                </li>
                <li>
                  Beneficiary-wise payment reports: the compensation report stops at parcel level.
                </li>
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function formatCell(value: string | number | null, type: ReportColumn['type']): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  switch (type) {
    case 'DATE':
      return formatDate(String(value))
    case 'MONEY':
      return formatMoney(Number(value))
    case 'NUMBER':
      return formatNumber(Number(value))
    default:
      return String(value)
  }
}
