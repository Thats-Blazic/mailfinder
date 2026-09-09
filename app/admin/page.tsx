import { CircleDollarSign, Mail, Search, ShieldCheck, UserMinus, Users, Wallet } from 'lucide-react'
import { PageHeader, Stat, formatDate } from '@/components/page-ui'
import { prisma } from '@/lib/db'

export default async function AdminOverviewPage() {
  const now = new Date()
  const [users, activeUsers, usersWithoutPlan, activePlans, pendingPayments, completedSearches, emailsFound, activity] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { plans: { none: { status: 'ACTIVE', expiresAt: { gt: now } } } } }),
    prisma.userPlan.count({ where: { status: 'ACTIVE', expiresAt: { gt: now } } }),
    prisma.payment.count({ where: { status: { in: ['PENDING', 'MORE_INFO_REQUIRED'] } } }),
    prisma.search.count({ where: { status: 'COMPLETED' } }),
    prisma.emailResult.count(),
    prisma.auditLog.findMany({ include: { admin: true }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ])
  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Command center" title="Administration overview" description="Live operational totals and security-relevant activity from Ghost Mail Finder." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Total users" value={users} />
        <Stat icon={ShieldCheck} label="Active users" value={activeUsers} />
        <Stat icon={UserMinus} label="Users without plan" value={usersWithoutPlan} />
        <Stat icon={Wallet} label="Active plans" value={activePlans} />
        <Stat icon={CircleDollarSign} label="Pending payments" value={pendingPayments} />
        <Stat icon={Search} label="Completed searches" value={completedSearches} />
        <Stat icon={Mail} label="Emails found" value={emailsFound.toLocaleString()} />
      </div>
      <section className="table-shell">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-white">Recent activity</h2>
          <p className="mt-1 text-xs text-slate-500">Registrations, plan assignments, payments, searches, and administrator actions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Administrator</th>
                <th>Target</th>
                <th>IP</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium !text-white">{item.action.replaceAll('_', ' ')}</td>
                  <td>{item.admin?.email || 'System'}</td>
                  <td>{item.targetType}{item.targetId ? ` · ${item.targetId}` : ''}</td>
                  <td>{item.ipAddress || '—'}</td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
