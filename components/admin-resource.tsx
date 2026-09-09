import Link from 'next/link'
import { Database } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill, formatDate } from '@/components/page-ui'
import { prisma } from '@/lib/db'
import { PaymentReview } from '@/components/admin-actions'

type Resource = 'users' | 'plans' | 'payments' | 'searches' | 'audit'

export async function AdminResource({ resource }: { resource: Resource }) {
  if (resource === 'users') {
    const rows = await prisma.user.findMany({ include: { plans: { where: { status: 'ACTIVE', expiresAt: { gt: new Date() } }, include: { plan: true }, take: 1 } }, orderBy: { createdAt: 'desc' }, take: 100 })
    return <ResourceShell title="Users" description="Accounts, access state, and plan administration." headers={['User', 'Role', 'Plan', 'Status', 'Last login', 'Created']} empty={!rows.length}>{rows.map((row) => <tr key={row.id}><td><Link href={`/admin/users/${row.id}`} className="font-medium text-white hover:text-cyan-300">{row.name}<small className="mt-1 block text-slate-500">{row.email}</small></Link></td><td>{row.role}</td><td>{row.plans[0]?.plan.name || 'No Plan'}</td><td><StatusPill value={row.status} /></td><td>{formatDate(row.lastLoginAt)}</td><td>{formatDate(row.createdAt)}</td></tr>)}</ResourceShell>
  }
  if (resource === 'plans') {
    const rows = await prisma.plan.findMany({ orderBy: { price: 'asc' } })
    return <ResourceShell title="Plans" description="Configured products. Plan changes require the admin plan API." headers={['Plan', 'Price', 'Duration', 'Availability', 'Updated']} empty={!rows.length}>{rows.map((row) => <tr key={row.id}><td className="font-medium !text-white">{row.name}<small className="mt-1 block max-w-md text-slate-500">{row.description}</small></td><td>{row.price.toString()} {row.currency}</td><td>{row.durationDays} days</td><td><StatusPill value={row.active ? 'ACTIVE' : 'INACTIVE'} /></td><td>{formatDate(row.updatedAt)}</td></tr>)}</ResourceShell>
  }
  if (resource === 'payments') {
    const rows = await prisma.payment.findMany({ include: { user: true, plan: true }, orderBy: { createdAt: 'desc' }, take: 100 })
    return (
      <div className="space-y-7">
        <PageHeader eyebrow="Administration" title="Payments" description="Review the crypto screenshot, then assign the plan. Nothing activates automatically." />
        {!rows.length ? (
          <EmptyState icon={Database} title="No payments" description="There are no matching database records yet." />
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <article key={row.id} className="panel grid gap-5 p-5 lg:grid-cols-[220px_1fr_240px]">
                {row.proofImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/admin/payments/${row.id}/proof`} alt="Payment screenshot" className="h-40 w-full rounded-xl object-cover" />
                ) : (
                  <div className="grid h-40 place-items-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">No screenshot</div>
                )}
                <div>
                  <p className="font-semibold text-white">{row.user.name}</p>
                  <p className="text-xs text-slate-500">{row.user.email}</p>
                  <p className="mt-4 text-sm text-slate-300">
                    {row.plan.name} · {row.amount.toString()} {row.cryptocurrency}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">{row.walletAddress}</p>
                  {row.telegramHandle && <p className="mt-2 text-xs text-cyan-300">Telegram @{row.telegramHandle}</p>}
                  {row.transactionHash && <p className="mt-2 break-all text-xs text-slate-400">{row.transactionHash}</p>}
                  <div className="mt-3"><StatusPill value={row.status} /></div>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(row.createdAt)}</p>
                </div>
                <div>
                  {['PENDING', 'MORE_INFO_REQUIRED'].includes(row.status) && (row.proofImage || row.transactionHash) ? (
                    <PaymentReview id={row.id} />
                  ) : (
                    <p className="text-xs text-slate-500">No review action available.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (resource === 'searches') {
    const rows = await prisma.search.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 100 })
    return <ResourceShell title="Searches" description="Operational view of all customer discovery jobs." headers={['Search', 'User', 'Status', 'Progress', 'Emails', 'Created']} empty={!rows.length}>{rows.map((row) => <tr key={row.id}><td className="font-medium !text-white">{row.name}</td><td>{row.user.email}</td><td><StatusPill value={row.status} /></td><td>{row.processedCount} / {row.domainCount}</td><td>{row.emailsFound}</td><td>{formatDate(row.createdAt)}</td></tr>)}</ResourceShell>
  }
  const rows = await prisma.auditLog.findMany({ include: { admin: true }, orderBy: { createdAt: 'desc' }, take: 100 })
  return <ResourceShell title="Audit logs" description="Administrator actions and target records." headers={['Action', 'Administrator', 'Target', 'Address', 'Created']} empty={!rows.length}>{rows.map((row) => <tr key={row.id}><td className="font-medium !text-white">{row.action.replaceAll('_', ' ')}</td><td>{row.admin?.email || 'System'}</td><td>{row.targetType}{row.targetId ? ` · ${row.targetId}` : ''}</td><td>{row.ipAddress || '—'}</td><td>{formatDate(row.createdAt)}</td></tr>)}</ResourceShell>
}

function ResourceShell({ title, description, headers, empty, children }: { title: string; description: string; headers: string[]; empty: boolean; children: React.ReactNode }) {
  return <div className="space-y-7"><PageHeader eyebrow="Administration" title={title} description={description} />{empty ? <EmptyState icon={Database} title={`No ${title.toLowerCase()}`} description="There are no matching database records yet." /> : <div className="table-shell overflow-x-auto"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}</div>
}
