'use client'

import { FormEvent, useState } from 'react'

export function SettingsForm({ general, finder, payments, system }: { general: unknown; finder: unknown; payments: unknown; system: unknown }) {
  const [values, setValues] = useState({
    general: JSON.stringify(general, null, 2),
    finder: JSON.stringify(finder, null, 2),
    payments: JSON.stringify(payments, null, 2),
    system: JSON.stringify(system, null, 2),
  })
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('')
    try {
      const parsed = Object.fromEntries(Object.entries(values).map(([section, value]) => [section, JSON.parse(value)]))
      const responses = await Promise.all(Object.entries(parsed).map(([section, value]) => fetch(`/api/admin/settings/${section}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })))
      const failed = responses.find((response) => !response.ok)
      if (failed) {
        const payload = await failed.json().catch(() => ({}))
        throw new Error(payload.error || 'Settings could not be saved')
      }
      setMessage('Settings saved.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Settings could not be saved') }
  }
  const labels = { general: 'General', finder: 'Email finder', payments: 'Crypto payments', system: 'System' }
  return <form onSubmit={submit} className="grid gap-5 xl:grid-cols-2">{Object.entries(values).map(([section, value]) => <label key={section} className="panel block p-5 text-xs font-medium text-slate-300">{labels[section as keyof typeof labels]} configuration<textarea value={value} onChange={(event) => setValues((current) => ({ ...current, [section]: event.target.value }))} className="field mt-3 min-h-64 font-mono text-xs" spellCheck={false} /></label>)}<div className="xl:col-span-2"><button className="primary-btn">Save system settings</button>{message && <span className="ml-3 text-xs text-slate-400">{message}</span>}</div></form>
}
