'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clipboard, Download, ExternalLink, FileText, LoaderCircle, Search } from 'lucide-react'
import { DarkSelect } from '@/components/dark-select'

type Result = {
  id: string
  email: string
  emailType: string
  sourceUrl: string
  sourceType: string
  confidence: number
  status: string
  foundAt: string
  domain: { hostname: string }
}

export function ResultsTable({
  searchId,
  initialStatus,
  initialProcessed,
  initialEmailsFound,
  domainCount,
}: {
  searchId: string
  initialStatus: string
  initialProcessed: number
  initialEmailsFound: number
  domainCount: number
}) {
  const [status, setStatus] = useState(initialStatus)
  const [processed, setProcessed] = useState(initialProcessed)
  const [emailsFound, setEmailsFound] = useState(initialEmailsFound)
  const [currentHosts, setCurrentHosts] = useState<string[]>([])
  const [rows, setRows] = useState<Result[]>([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<'found' | 'domain' | 'confidence'>('found')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadResults = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (query) params.set('q', query)
    if (type) params.set('type', type)
    const response = await fetch(`/api/searches/${searchId}/results?${params}`, { cache: 'no-store' })
    if (!response.ok) return
    const body = await response.json()
    setRows(body.results)
    setPages(Math.max(1, body.pages))
    setTotal(body.total)
    setLoading(false)
  }, [page, query, searchId, type])

  const loadProgress = useCallback(async () => {
    const response = await fetch(`/api/searches/${searchId}`, { cache: 'no-store' })
    if (!response.ok) return
    const body = await response.json()
    setStatus(body.search.status)
    setProcessed(body.search.processedCount)
    setEmailsFound(body.search.emailsFound)
    setCurrentHosts(
      (body.search.domains || [])
        .filter((domain: { status: string }) => domain.status === 'PROCESSING')
        .map((domain: { hostname: string }) => domain.hostname),
    )
  }, [searchId])

  useEffect(() => {
    const timeout = setTimeout(() => void loadResults(), 200)
    return () => clearTimeout(timeout)
  }, [loadResults])

  useEffect(() => {
    if (!['QUEUED', 'PROCESSING'].includes(status)) return
    const interval = setInterval(() => {
      void loadProgress()
      void loadResults()
    }, 2_000)
    return () => clearInterval(interval)
  }, [loadProgress, loadResults, status])

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    if (sort === 'domain') return a.domain.hostname.localeCompare(b.domain.hostname)
    if (sort === 'confidence') return b.confidence - a.confidence
    return new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime()
  }), [rows, sort])
  const progress = domainCount ? Math.round((processed / domainCount) * 100) : 0

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function copySelected() {
    const emails = rows.filter((row) => selected.includes(row.id)).map((row) => row.email)
    await navigator.clipboard.writeText(emails.join('\n'))
  }

  function downloadSelected() {
    const emails = [...new Set(rows.filter((row) => selected.includes(row.id)).map((row) => row.email))].sort((a, b) =>
      a.localeCompare(b),
    )
    const blob = new Blob([emails.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'emails.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {['QUEUED', 'PROCESSING'].includes(status) && (
        <div className="panel p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-2"><LoaderCircle className="size-4 animate-spin text-cyan-300" />Realtime queue progress</span>
            <b className="text-white">{processed} / {domainCount} sites · {emailsFound} emails</b>
          </div>
          {currentHosts.length > 0 && (
            <p className="mt-2 text-xs text-cyan-200">Scanning now: {currentHosts.join(', ')}</p>
          )}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      <div className="table-shell">
        <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-[1fr_auto_auto]">
          <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} className="field pl-9" placeholder="Search domain or email" /></label>
          <DarkSelect
            className="md:w-44"
            value={type}
            onChange={(value) => { setType(value); setPage(1) }}
            options={[
              { value: '', label: 'All types' },
              { value: 'GENERAL', label: 'General' },
              { value: 'SALES', label: 'Sales' },
              { value: 'SUPPORT', label: 'Support' },
              { value: 'PERSONAL', label: 'Personal' },
            ]}
          />
          <DarkSelect
            className="md:w-44"
            value={sort}
            onChange={(value) => setSort(value as typeof sort)}
            options={[
              { value: 'found', label: 'Newest first' },
              { value: 'domain', label: 'Domain' },
              { value: 'confidence', label: 'Confidence' },
            ]}
          />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-cyan-300/[.04] px-4 py-3 text-xs text-cyan-200">
            <Check className="size-4" />
            {selected.length} selected
            <button onClick={copySelected} className="secondary-btn ml-auto">
              <Clipboard className="size-3.5" />
              Copy
            </button>
            <button onClick={downloadSelected} className="secondary-btn">
              <FileText className="size-3.5" />
              Download emails
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Select</th><th>Domain</th><th>Email</th><th>Email type</th><th>Source URL</th><th>Source type</th><th>Confidence</th><th>Status</th><th>Found at</th></tr></thead>
            <tbody>{sorted.map((row) => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.email}`} /></td><td className="font-medium !text-white">{row.domain.hostname}</td><td><a className="text-cyan-300" href={`mailto:${row.email}`}>{row.email}</a></td><td>{row.emailType}</td><td><a className="inline-flex max-w-52 items-center gap-1 truncate text-slate-300 hover:text-cyan-300" href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceUrl}<ExternalLink className="size-3 shrink-0" /></a></td><td>{row.sourceType}</td><td>{row.confidence}%</td><td>{row.status}</td><td>{new Date(row.foundAt).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
        {!loading && !rows.length && <div className="p-10 text-center text-sm text-slate-500">{['QUEUED', 'PROCESSING'].includes(status) ? 'Waiting for the first result…' : 'No matching public emails found.'}</div>}
        <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{total.toLocaleString()} results</span>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/searches/${searchId}/export?format=txt`} className="secondary-btn">
              <Download className="size-3.5" />
              Download emails
            </a>
            <button className="secondary-btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span className="self-center">Page {page} of {pages}</span>
            <button className="secondary-btn" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
