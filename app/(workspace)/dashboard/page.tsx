import Link from 'next/link'
import { CalendarClock, CreditCard, Globe2, Mail, Radar, Search, ShieldAlert } from 'lucide-react'
import { PageHeader, Stat, StatusPill, formatDate, EmptyState } from '@/components/page-ui'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { quotaForPlanName } from '@/lib/plans'

export default async function DashboardPage() {
  const user = await requireUser()
  const activePlan = user.plans[0]
  const quota = quotaForPlanName(activePlan?.plan.name)
  const [summary, recent, recentPayments, latestPlan] = await Promise.all([
    prisma.search.aggregate({ where: { userId: user.id }, _sum: { domainCount: true, emailsFound: true }, _count: true }),
    prisma.search.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.payment.findMany({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.userPlan.findFirst({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' } }),
  ])
  const planExpired = !activePlan && latestPlan?.status === 'EXPIRED'
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace intelligence"
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description="Your live discovery activity, plan status, and recent payments."
        actions={activePlan ? <Link href="/finder" className="primary-btn"><Search className="size-4" />New search</Link> : <Link href="/billing" className="primary-btn">View plans</Link>}
      />
      {!activePlan && (
        <section className="panel border-amber-300/20 bg-amber-300/[.04] p-6 sm:p-8">
          <ShieldAlert className="size-7 text-amber-300" />
          <h2 className="mt-4 text-xl font-semibold text-white">{planExpired ? 'Your plan has expired.' : 'No active plan'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {planExpired
              ? 'Send a new crypto payment screenshot from Billing so an administrator can activate a plan.'
              : 'Choose a plan, send crypto, and upload a screenshot. Searching starts after admin approval.'}
          </p>
          <Link href="/billing" className="primary-btn mt-5">{planExpired ? 'Renew plan' : 'View plans'}</Link>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CreditCard} label="Current plan" value={activePlan?.plan.name || 'No Plan'} detail={activePlan ? 'Active' : 'Inactive'} />
        <Stat icon={Radar} label="Search limit" value={activePlan ? quota.maxBatch : '—'} detail={activePlan ? quota.label : 'Activate a plan'} />
        <Stat icon={CalendarClock} label="Plan expiration" value={activePlan ? formatDate(activePlan.expiresAt) : '—'} detail="No automatic renewal" />
        <Stat icon={Globe2} label="Sites scanned" value={(summary._sum.domainCount || 0).toLocaleString()} detail={`${summary._count} searches`} />
        <Stat icon={Mail} label="Emails found" value={(summary._sum.emailsFound || 0).toLocaleString()} detail="Public addresses recorded" />
      </div>
      {!recent.length ? (
        <EmptyState
          icon={Search}
          title="No searches yet"
          description="Paste or upload your first website list after a plan is activated."
          action={<Link href={activePlan ? '/finder' : '/billing'} className="primary-btn">{activePlan ? 'Open finder' : 'View plans'}</Link>}
        />
      ) : (
        <div className="table-shell">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent searches</h2>
              <p className="mt-1 text-xs text-slate-500">Latest workspace jobs</p>
            </div>
            <Link href="/results" className="text-xs text-cyan-300">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Sites</th>
                  <th>Emails</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className="font-medium text-white hover:text-cyan-300" href={`/results/${item.id}`}>{item.name}</Link>
                    </td>
                    <td><StatusPill value={item.status} /></td>
                    <td>{item.processedCount} / {item.domainCount}</td>
                    <td>{item.emailsFound}</td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Recent payments</h2>
        {!recentPayments.length ? (
          <EmptyState icon={CreditCard} title="No payment history" description="Crypto payment screenshots and administrator decisions appear here." />
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-medium !text-white">{payment.plan.name}</td>
                    <td>{payment.amount.toString()} {payment.cryptocurrency}</td>
                    <td><StatusPill value={payment.status} /></td>
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
