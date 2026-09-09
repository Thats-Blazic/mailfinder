import { CreditCard, Send, Wallet } from 'lucide-react'
import { BillingCheckout } from '@/components/billing-actions'
import { EmptyState, PageHeader, StatusPill, formatDate } from '@/components/page-ui'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { quotaForPlanName } from '@/lib/plans'
import { getPaymentSettings } from '@/lib/settings'

export default async function BillingPage() {
  const user = await requireUser()
  const [plans, payments, settings] = await Promise.all([
    prisma.plan.findMany({ where: { active: true }, orderBy: { price: 'asc' } }),
    prisma.payment.findMany({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' } }),
    getPaymentSettings(),
  ])
  const currencies = Object.entries(settings.cryptocurrencies)
    .filter(([, config]) => config.enabled && config.address)
    .map(([symbol]) => symbol)
  const safePlans = plans.map((plan) => ({ ...plan, price: plan.price.toString(), cryptoPrice: plan.cryptoPrice }))
  const activePlan = user.plans[0]
  const quota = quotaForPlanName(activePlan?.plan.name)

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Plans and payments"
        title="Billing"
        description="Choose a plan, send crypto to the wallet, and upload a payment screenshot. Plans activate only after an administrator reviews the proof."
      />
      <div className="panel grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.15em] text-slate-600">Current plan</p>
          <p className="mt-2 font-semibold text-white">{activePlan?.plan.name || 'No Plan'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[.15em] text-slate-600">Expiration</p>
          <p className="mt-2 font-semibold text-white">{activePlan ? formatDate(activePlan.expiresAt) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[.15em] text-slate-600">Search limit</p>
          <p className="mt-2 font-semibold text-white">{activePlan ? quota.label : 'Activate a plan to search'}</p>
        </div>
      </div>
      <BillingCheckout plans={safePlans} cryptocurrencies={currencies} />
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <CreditCard className="size-4 text-cyan-300" />
          Payment history
        </h2>
        {!payments.length ? (
          <EmptyState icon={Wallet} title="No payment requests" description="Your first crypto request and screenshot will appear here." />
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Proof</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-medium !text-white">{payment.plan.name}</td>
                    <td>
                      {payment.amount.toString()} {payment.cryptocurrency}
                    </td>
                    <td>
                      <StatusPill value={payment.status} />
                    </td>
                    <td>
                      {payment.proofImage ? (
                        <span className="inline-flex items-center gap-1 text-cyan-300">
                          <Send className="size-3.5" />
                          Screenshot sent
                        </span>
                      ) : (
                        payment.transactionHash || 'Waiting'
                      )}
                    </td>
                    <td>{formatDate(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
