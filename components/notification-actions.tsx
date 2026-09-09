'use client'

import { useState } from 'react'
import { CheckCheck, LoaderCircle } from 'lucide-react'

export function MarkNotificationsRead({ disabled }: { disabled: boolean }) {
  const [busy, setBusy] = useState(false)
  async function markAll() {
    setBusy(true)
    const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    if (response.ok) window.location.reload()
    else setBusy(false)
  }
  return <button disabled={disabled || busy} onClick={markAll} className="secondary-btn">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}Mark all read</button>
}
