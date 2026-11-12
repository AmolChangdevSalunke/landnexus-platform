import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '../../api/types'
import { Card, CardHeader } from '../../components/ui/Card'
import { formatNumber } from '../../utils/format'
import { formatMonth } from './labels'

/**
 * Six-month activity trend. Recharts is already a project dependency (used by
 * the legacy prototype), so no new chart library is introduced.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <Card className="mb-5 p-5">
      <CardHeader
        title="Six-month activity"
        description="Proposals submitted and acquisition cases opened per month, in Asia/Kolkata time."
      />

      {points.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No monthly activity in this scope yet.</p>
      ) : (
        <figure className="mt-4">
          <div
            className="h-64 w-full"
            role="img"
            aria-label="Bar chart of proposals submitted and cases opened over the last six months"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => formatMonth(String(value))}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  labelFormatter={(label) => formatMonth(String(label))}
                  formatter={(value) => formatNumber(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="proposalsSubmitted"
                  name="Proposals submitted"
                  fill="#1D4ED8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="casesOpened"
                  name="Cases opened"
                  fill="#0F766E"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <figcaption className="sr-only">
            <table>
              <caption>Six-month activity</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Proposals submitted</th>
                  <th scope="col">Cases opened</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.month}>
                    <th scope="row">{formatMonth(point.month)}</th>
                    <td>{formatNumber(point.proposalsSubmitted)}</td>
                    <td>{formatNumber(point.casesOpened)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figcaption>
        </figure>
      )}
    </Card>
  )
}
