import { FinderForm } from '@/components/finder-form'
import { PageHeader } from '@/components/page-ui'
import { requireUser } from '@/lib/auth'
import { quotaForPlanName } from '@/lib/plans'

export default async function FinderPage() {
  const user = await requireUser()
  const planName = user.plans[0]?.plan.name
  const quota = quotaForPlanName(planName)
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Domain intelligence"
        title="Find public business emails"
        description="Paste websites or upload a list. Ghost Mail Finder crawls public pages, sitemaps, and contact paths, then records every email with its source URL."
      />
      <FinderForm
        hasActivePlan={Boolean(user.plans[0])}
        planName={planName}
        maxBatch={quota.maxBatch}
        quotaLabel={quota.label}
      />
    </div>
  )
}
