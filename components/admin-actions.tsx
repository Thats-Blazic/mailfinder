'use client'

import { FormEvent, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { DarkSelect } from '@/components/dark-select'

export function AdminActionForm({ endpoint, method = 'POST', fields, submitLabel }: {
  endpoint: string
  method?: 'POST' | 'PATCH' | 'PUT'
  fields: Array<{ name: string; label: string; type?: string; defaultValue?: string | number | boolean; required?: boolean; options?: Array<{ label: string; value: string }> }>
  submitLabel: string
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget))
      for (const field of fields) {
        if (field.required === false && values[field.name] === '') {
          delete values[field.name]
          continue
        }
        if (field.type === 'number') values[field.name] = Number(values[field.name]) as never
        if (field.type === 'boolean') values[field.name] = (values[field.name] === 'true') as never
        if (field.type === 'json') values[field.name] = JSON.parse(String(values[field.name] || '{}')) as never
      }
      const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Action failed')
      setMessage('Saved successfully.')
      window.location.reload()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed') }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {fields.map((field) => (
        <label key={field.name} className="block text-xs text-slate-300">
          {field.label}
          {field.options ? (
            <FormSelect
              name={field.name}
              defaultValue={String(field.defaultValue ?? field.options[0]?.value ?? '')}
              options={field.options}
            />
          ) : field.type === 'json' ? (
            <textarea required={field.required !== false} name={field.name} defaultValue={String(field.defaultValue ?? '{}')} className="field mt-2 min-h-28 font-mono text-xs" />
          ) : (
            <input required={field.required !== false} name={field.name} defaultValue={String(field.defaultValue ?? '')} type={field.type === 'boolean' ? 'text' : field.type || 'text'} className="field mt-2" />
          )}
        </label>
      ))}
      <button disabled={busy} className="secondary-btn w-full">{busy ? <LoaderCircle className="size-4 animate-spin" /> : submitLabel}</button>
      {message && <p className="text-xs text-slate-400">{message}</p>}
    </form>
  )
}

function FormSelect({
  name,
  defaultValue,
  options,
}: {
  name: string
  defaultValue: string
  options: Array<{ label: string; value: string }>
}) {
  const [value, setValue] = useState(defaultValue)
  return <DarkSelect className="mt-2" name={name} value={value} onChange={setValue} options={options} />
}

export function PaymentReview({ id }: { id: string }) {
  return <AdminActionForm endpoint={`/api/admin/payments/${id}/review`} fields={[{ name: 'action', label: 'Decision', options: [{ label: 'Approve', value: 'APPROVE' }, { label: 'Request information', value: 'REQUEST_INFO' }, { label: 'Reject', value: 'REJECT' }] }, { name: 'adminNote', label: 'Admin note' }]} submitLabel="Review payment" />
}
