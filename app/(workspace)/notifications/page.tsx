import { Bell } from 'lucide-react'
import { EmptyState, PageHeader, formatDate } from '@/components/page-ui'
import { MarkNotificationsRead } from '@/components/notification-actions'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function NotificationsPage() {
  const user = await requireUser()
  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 })
  return <div className="space-y-7"><PageHeader eyebrow="Account activity" title="Notifications" description="Plan, payment, and search events from your Ghost Mail Finder workspace." actions={<MarkNotificationsRead disabled={!notifications.some((item) => !item.readAt)} />} />{!notifications.length ? <EmptyState icon={Bell} title="You’re all caught up" description="New account and search events will appear here." /> : <div className="panel divide-y divide-white/[.07]">{notifications.map((item) => <article key={item.id} className={`flex gap-4 p-5 ${item.readAt ? 'opacity-60' : ''}`}><span className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt ? 'bg-slate-700' : 'bg-cyan-300'}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium text-white">{item.title}</h2><span className="text-[10px] uppercase tracking-wider text-slate-600">{item.type.replaceAll('_', ' ')}</span></div><p className="mt-1 text-sm leading-6 text-slate-400">{item.message}</p><time className="mt-2 block text-[11px] text-slate-600">{formatDate(item.createdAt)}</time></div></article>)}</div>}</div>
}
