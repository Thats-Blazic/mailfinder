import Link from 'next/link'
import { Search } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill, formatDate } from '@/components/page-ui'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser()
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const take = 20
  const [searches, total] = await Promise.all([prisma.search.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }), prisma.search.count({ where: { userId: user.id } })])
  const pages = Math.max(1, Math.ceil(total / take))
  return <div className="space-y-7"><PageHeader eyebrow="Search archive" title="Results" description="Track every queued, active, completed, and failed discovery job." actions={<Link href="/finder" className="primary-btn">New search</Link>} />{!searches.length ? <EmptyState icon={Search} title="No results to show" description="Completed and active searches will appear here." action={<Link href="/finder" className="primary-btn">Start a search</Link>} /> : <div className="table-shell"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Search</th><th>Status</th><th>Progress</th><th>Emails</th><th>Created</th><th>Download</th></tr></thead><tbody>{searches.map((item) => <tr key={item.id}><td><Link href={`/results/${item.id}`} className="font-medium text-white hover:text-cyan-300">{item.name}</Link></td><td><StatusPill value={item.status} /></td><td>{item.processedCount} / {item.domainCount}</td><td>{item.emailsFound}</td><td>{formatDate(item.createdAt)}</td><td><Link href={`/api/searches/${item.id}/export?format=txt`} className="secondary-btn">Emails TXT</Link></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-white/10 p-4 text-xs text-slate-500"><span>Page {page} of {pages} · {total} searches</span><div className="flex gap-2">{page > 1 && <Link className="secondary-btn" href={`/results?page=${page - 1}`}>Previous</Link>}{page < pages && <Link className="secondary-btn" href={`/results?page=${page + 1}`}>Next</Link>}</div></div></div>}</div>
}
