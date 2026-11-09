import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { RateCardsTab } from './RateCardsTab'
import { RuleSetsTab } from './RuleSetsTab'

export function RateRulesPage() {
  const [activeTab, setActiveTab] = useState('rates')

  const tabs: TabItem[] = [
    { id: 'rates', label: 'Rate cards', content: <RateCardsTab /> },
    { id: 'rule-sets', label: 'Rule sets', content: <RuleSetsTab /> },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Module 5 · Compensation"
        title="Rate cards and rule sets"
        description="Market value rates and the rule sets that turn them into an estimate. Nothing is calculated until an authorised officer enters the values and a second officer approves them."
      />

      <Card className="p-4">
        <Tabs
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
          label="Rate cards and rule sets"
        />
      </Card>
    </>
  )
}
