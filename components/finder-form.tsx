'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { AlertTriangle, Check, FileUp, Gauge, Globe, Layers, LoaderCircle, Play, Radar, X, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DarkSelect } from '@/components/dark-select'

const hostname = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

function inspect(value: string) {
  const valid = new Set<string>()
  const invalid: string[] = []
  let duplicates = 0
  for (const raw of value.split(/[\s,;"]+/).filter(Boolean)) {
    let candidate = raw.trim().toLowerCase()
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`)
      candidate = url.hostname.replace(/^www\./, '').replace(/\.$/, '')
      if (url.port || !hostname.test(candidate)) throw new Error()
    } catch {
      invalid.push(raw)
      continue
    }
    if (valid.has(candidate)) duplicates += 1
    else valid.add(candidate)
  }
  return { domains: [...valid], invalid, duplicates }
}

export function FinderForm({
  hasActivePlan,
  planName,
  maxBatch,
  quotaLabel,
}: {
  hasActivePlan: boolean
  planName?: string
  maxBatch: number
  quotaLabel: string
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState('DEEP')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const parsed = useMemo(() => inspect(text), [text])
  const canRun = hasActivePlan && parsed.domains.length > 0 && parsed.domains.length <= maxBatch

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/\.(csv|txt)$/i.test(file.name) || file.size > 2_000_000) {
      setError('Choose a CSV or TXT file smaller than 2 MB.')
      return
    }
    setText(await file.text())
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
    setError('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canRun) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mode, domains: parsed.domains }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'The search could not be started')
      router.push(`/results/${body.search?.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The search could not be started')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="panel overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <label className="text-xs font-medium text-slate-300">
            Search name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="September agency outreach"
              className="field mt-2"
            />
          </label>
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Globe className="size-4 text-cyan-300" />
                Websites
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Paste domains or URLs. Deep scan crawls public pages, sitemaps, and contact pages.
              </p>
            </div>
            <label className="secondary-btn cursor-pointer">
              <FileUp className="size-4" />
              Upload CSV / TXT
              <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={upload} className="sr-only" />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="field mt-4 min-h-[320px] resize-y font-mono leading-7"
            placeholder={'acme.com\nhttps://example.org/contact\nstudio.io'}
          />
        </div>
      </div>
      <aside className="space-y-5">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-white">Input health</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Metric icon={Check} label="Valid sites" value={parsed.domains.length} good />
            <Metric icon={AlertTriangle} label="Invalid entries" value={parsed.invalid.length} />
            <Metric icon={X} label="Duplicates removed" value={parsed.duplicates} />
          </div>
          {parsed.invalid.length > 0 && (
            <p className="mt-4 break-words text-xs leading-5 text-rose-300">
              Invalid: {parsed.invalid.slice(0, 5).join(', ')}
              {parsed.invalid.length > 5 ? ` +${parsed.invalid.length - 5} more` : ''}
            </p>
          )}
        </div>
        <div className="panel p-5">
          <p className="text-xs font-medium text-slate-300">Scan depth</p>
          <DarkSelect
            className="mt-2"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'FAST', label: 'Fast', description: 'Homepage and key pages', icon: Zap },
              { value: 'STANDARD', label: 'Standard', description: 'Contact, about, sitemap', icon: Gauge },
              { value: 'DEEP', label: 'Deep', description: 'Crawl the public site', icon: Radar },
            ]}
          />
          <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="size-3.5 text-cyan-300" />
                Plan
              </span>
              <b className="text-white">{planName || 'No plan'}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <Radar className="size-3.5 text-cyan-300" />
                Limit
              </span>
              <b className="text-right text-white">{quotaLabel}</b>
            </div>
            <div className="flex justify-between">
              <span>This batch</span>
              <b className="text-white">
                {parsed.domains.length} / {maxBatch}
              </b>
            </div>
          </div>
        </div>
        {!hasActivePlan && <div className="notice notice-error">An active plan is required. Pay from Billing and wait for admin approval.</div>}
        {parsed.domains.length > maxBatch && (
          <div className="notice notice-error">
            {planName || 'This plan'} can scan {maxBatch} sites at once. Split the list or upgrade.
          </div>
        )}
        {error && (
          <div role="alert" className="notice notice-error">
            {error}
          </div>
        )}
        <button disabled={!canRun || busy} className="primary-btn w-full">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <><Play className="size-4" />Start search</>}
        </button>
      </aside>
    </form>
  )
}

function Metric({ icon: Icon, label, value, good }: { icon: typeof Check; label: string; value: number; good?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`size-4 ${good ? 'text-emerald-300' : 'text-slate-500'}`} />
      <span className="flex-1 text-slate-400">{label}</span>
      <b className="text-white">{value}</b>
    </div>
  )
}
