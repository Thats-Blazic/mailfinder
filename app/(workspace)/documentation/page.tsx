import { BookOpen, FileUp, Search, ShieldCheck, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/page-ui'

const sections = [
  { icon: Wallet, title: 'Activate a plan', body: 'Pick Starter, Pro, or Business. Send the exact crypto amount to the wallet, then upload a payment screenshot like you would on Telegram. An administrator reviews the image and turns the plan on.' },
  { icon: FileUp, title: 'Prepare websites', body: 'Paste hostnames or URLs, or upload a UTF-8 CSV/TXT file under 2 MB. Ghost Mail Finder normalizes www prefixes, removes duplicates, and rejects IP addresses.' },
  { icon: Search, title: 'Run a deep scan', body: 'Starter can scan 30 sites every 30 minutes. Pro and Business can scan up to 1,000 sites at once with no waiting period. Deep mode crawls public pages, sitemaps, and contact paths.' },
  { icon: ShieldCheck, title: 'Review sources', body: 'Every address is tied to a site, source URL, source type, confidence score, and discovery time. Ghost Mail Finder is designed for public business information.' },
]

export default function DocumentationPage() {
  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Product guide" title="Documentation" description="The practical workflow for reliable, auditable public email discovery." />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {sections.map(({ icon: Icon, title, body }, index) => (
          <article key={title} className="panel p-6">
            <span className="grid size-10 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300">
              <Icon className="size-5" />
            </span>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-600">Step {index + 1}</p>
            <h2 className="mt-2 font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
          </article>
        ))}
      </div>
      <div className="panel p-6">
        <BookOpen className="size-5 text-cyan-300" />
        <h2 className="mt-4 font-semibold text-white">Status and exports</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Queued searches wait to start, processing searches are actively crawling public pages, and completed searches are ready to export. CSV and XLSX exports are available from a search detail page. Failed searches retain their error message and any results already recorded.
        </p>
      </div>
    </div>
  )
}
