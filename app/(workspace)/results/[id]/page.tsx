import Link from 'next/link'
import { Download, FileText, Mail } from 'lucide-react'
import { notFound } from 'next/navigation'
import { PageHeader, Stat, StatusPill, formatDate } from '@/components/page-ui'
import { ResultsTable } from '@/components/results-table'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const search = await prisma.search.findFirst({ where: { id, userId: user.id } })
  if (!search) notFound()
  const progress = search.domainCount ? Math.round((search.processedCount / search.domainCount) * 100) : 0

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Search detail"
        title={search.name}
        description={`Created ${formatDate(search.createdAt)} · ${search.mode.toLowerCase()} scan`}
        actions={
          <>
            <Link href={`/api/searches/${id}/export?format=txt`} className="primary-btn">
              <FileText className="size-4" />
              Download emails
            </Link>
            <Link href={`/api/searches/${id}/export?format=csv`} className="secondary-btn">
              <Download className="size-4" />
              CSV
            </Link>
            <Link href={`/api/searches/${id}/export?format=xlsx`} className="secondary-btn">
              <Download className="size-4" />
              XLSX
            </Link>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Mail} label="Status" value={<StatusPill value={search.status} />} />
        <Stat icon={Mail} label="Progress" value={`${progress}%`} detail={`${search.processedCount} of ${search.domainCount} sites`} />
        <Stat icon={Mail} label="Emails found" value={search.emailsFound} />
      </div>
      {search.error && <div className="notice notice-error">{search.error}</div>}
      <ResultsTable
        searchId={search.id}
        initialStatus={search.status}
        initialProcessed={search.processedCount}
        initialEmailsFound={search.emailsFound}
        domainCount={search.domainCount}
      />
    </div>
  )
}
