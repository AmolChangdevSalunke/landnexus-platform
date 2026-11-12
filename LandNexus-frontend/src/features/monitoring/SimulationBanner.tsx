import { Alert } from '../../components/ui/Alert'

/**
 * The backend stores every payment with mode SIMULATED. This banner makes that
 * impossible to miss wherever payment figures are shown.
 */
export function SimulationBanner({ className }: { className?: string }) {
  return (
    <Alert
      variant="warning"
      title="SIMULATED PAYMENT – NO REAL MONEY TRANSFERRED"
      className={className}
    >
      Payment records in this deployment are simulated. There is no PFMS, DBT or bank
      integration, and no funds have moved. Amounts are shown only to monitor the
      compensation workflow.
    </Alert>
  )
}
