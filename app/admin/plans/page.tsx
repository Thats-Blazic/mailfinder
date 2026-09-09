import { AdminResource } from '@/components/admin-resource'
import { AdminActionForm } from '@/components/admin-actions'
import { prisma } from '@/lib/db'

export default async function AdminPlansPage() {
  const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } })
  return <div className="space-y-7"><AdminResource resource="plans" /><details className="panel p-5"><summary className="cursor-pointer text-sm font-semibold text-white">Create a paid plan</summary><div className="mt-5 max-w-xl"><AdminActionForm endpoint="/api/admin/plans" fields={planFields()} submitLabel="Create plan" /></div></details><div className="grid gap-4 lg:grid-cols-2">{plans.map((plan) => <details key={plan.id} className="panel p-5"><summary className="cursor-pointer text-sm font-semibold text-white">Edit {plan.name}</summary><div className="mt-5"><AdminActionForm endpoint={`/api/admin/plans/${plan.id}`} method="PUT" fields={planFields({ ...plan, price: plan.price.toString(), cryptoPrice: JSON.stringify(plan.cryptoPrice || {}, null, 2) })} submitLabel="Save plan" /></div></details>)}</div></div>
}

function planFields(plan?: { name: string; description: string; price: string; currency: string; cryptoPrice: string; durationDays: number; active: boolean }) {
  return [
    { name: 'name', label: 'Name', defaultValue: plan?.name || '' },
    { name: 'description', label: 'Description', defaultValue: plan?.description || '' },
    { name: 'price', label: 'Fiat display price', type: 'number', defaultValue: plan?.price || 49 },
    { name: 'currency', label: 'Display currency', defaultValue: plan?.currency || 'USD' },
    { name: 'cryptoPrice', label: 'Exact crypto amounts (JSON)', type: 'json', defaultValue: plan?.cryptoPrice || '{\n  "BTC": 0.0005,\n  "SOL": 0.35,\n  "ETH": 0.02\n}' },
    { name: 'durationDays', label: 'Duration in days', type: 'number', defaultValue: plan?.durationDays || 30 },
    { name: 'active', label: 'Availability', type: 'boolean', defaultValue: plan?.active ?? true, options: [{ label: 'Active', value: 'true' }, { label: 'Disabled', value: 'false' }] },
  ]
}
