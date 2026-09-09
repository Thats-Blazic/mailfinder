import type { LucideIcon } from 'lucide-react'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-cyan-300">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-[-.04em] text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, detail, icon: Icon }: { label: string; value: React.ReactNode; detail?: string; icon: LucideIcon }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        {label}<span className="grid size-8 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300"><Icon className="size-4" /></span>
      </div>
      <div className="mt-5 text-2xl font-semibold tracking-tight text-white">{value}</div>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="panel grid min-h-64 place-items-center p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-cyan-300"><Icon className="size-5" /></span>
        <h2 className="mt-4 font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

export function StatusPill({ value }: { value: string }) {
  const good = ['ACTIVE', 'APPROVED', 'COMPLETED'].includes(value)
  const warn = ['PENDING', 'QUEUED', 'PROCESSING', 'MORE_INFO_REQUIRED'].includes(value)
  return <span className={`status ${good ? 'status-good' : warn ? 'status-warn' : 'status-bad'}`}><i />{value.replaceAll('_', ' ')}</span>
}

export function formatDate(value: Date | string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
}
