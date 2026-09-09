import { notFound } from 'next/navigation'
import { AdminActionForm } from '@/components/admin-actions'
import { PageHeader, StatusPill, formatDate } from '@/components/page-ui'
import { prisma } from '@/lib/db'
import { quotaForPlanName } from '@/lib/plans'

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, plans, searchStats] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        plans: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 10 },
        payments: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        searches: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    }),
    prisma.plan.findMany({ where: { active: true }, orderBy: { price: 'asc' } }),
    prisma.search.aggregate({
      where: { userId: id },
      _count: true,
      _sum: { domainCount: true, emailsFound: true },
    }),
  ])
  if (!user) notFound()
  const activePlan = user.plans.find((item) => item.status === 'ACTIVE')
  const quota = quotaForPlanName(activePlan?.plan.name)

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="User administration"
        title={user.name}
        description={`${user.email} · joined ${formatDate(user.createdAt)}`}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="panel grid gap-5 p-5 sm:grid-cols-3">
            <Info label="Account status" value={<StatusPill value={user.status} />} />
            <Info label="Role" value={user.role} />
            <Info label="Current plan" value={activePlan?.plan.name || 'No Plan'} />
            <Info label="Search limit" value={activePlan ? quota.label : 'None'} />
            <Info label="Registration date" value={formatDate(user.createdAt)} />
            <Info label="Last login" value={formatDate(user.lastLoginAt)} />
            <Info label="Searches" value={searchStats._count.toLocaleString()} />
            <Info
              label="Sites / emails"
              value={`${(searchStats._sum.domainCount || 0).toLocaleString()} / ${(searchStats._sum.emailsFound || 0).toLocaleString()}`}
            />
            <Info label="Admin notes" value={user.adminNotes || 'None'} />
          </div>

          <HistoryTable headers={['Plan history', 'Status', 'Starts', 'Expires']}>
            {user.plans.map((item) => (
              <tr key={item.id}>
                <td className="font-medium !text-white">{item.plan.name}</td>
                <td><StatusPill value={item.status} /></td>
                <td>{formatDate(item.startsAt)}</td>
                <td>{formatDate(item.expiresAt)}</td>
              </tr>
            ))}
          </HistoryTable>

          <HistoryTable headers={['Payment history', 'Amount', 'Status', 'Proof', 'Created']}>
            {user.payments.map((item) => (
              <tr key={item.id}>
                <td className="font-medium !text-white">{item.plan.name}</td>
                <td>{item.amount.toString()} {item.cryptocurrency}</td>
                <td><StatusPill value={item.status} /></td>
                <td className="max-w-48 truncate">
                  {item.proofImage ? 'Screenshot' : item.transactionHash || 'Not submitted'}
                  {item.telegramHandle ? ` · @${item.telegramHandle}` : ''}
                </td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </HistoryTable>

          <HistoryTable headers={['Search history', 'Status', 'Sites', 'Emails', 'Created']}>
            {user.searches.map((item) => (
              <tr key={item.id}>
                <td className="font-medium !text-white">{item.name}</td>
                <td><StatusPill value={item.status} /></td>
                <td>{item.processedCount} / {item.domainCount}</td>
                <td>{item.emailsFound}</td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </HistoryTable>
        </div>

        <aside className="space-y-4">
          <Action title="Change account status">
            <AdminActionForm
              endpoint={`/api/admin/users/${id}/status`}
              method="PATCH"
              fields={[
                { name: 'status', label: 'Status', options: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Disabled', value: 'DISABLED' }] },
                { name: 'reason', label: 'Reason' },
              ]}
              submitLabel="Update status"
            />
          </Action>
          <Action title="Assign plan">
            <AdminActionForm
              endpoint={`/api/admin/users/${id}/plan`}
              fields={[
                { name: 'planId', label: 'Plan', options: plans.map((plan) => ({ label: plan.name, value: plan.id })) },
                { name: 'durationDays', label: 'Duration override (days)', type: 'number', required: false },
                { name: 'reason', label: 'Reason', defaultValue: 'Manual plan assignment' },
              ]}
              submitLabel="Assign plan"
            />
          </Action>
        </aside>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[10px] uppercase tracking-[.15em] text-slate-600">{label}</div><div className="mt-2 text-sm text-slate-200">{value}</div></div>
}

function Action({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel p-5"><h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>{children}</section>
}

function HistoryTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="table-shell overflow-x-auto"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}
