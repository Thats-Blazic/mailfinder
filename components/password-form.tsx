'use client'

import { FormEvent, useState } from 'react'

export function PasswordForm() {
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const response = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const body = await response.json().catch(() => ({}))
    setMessage(response.ok ? 'Password changed. Other sessions were signed out.' : body.error || 'Unable to change password')
    if (response.ok) event.currentTarget.reset()
  }
  return <form onSubmit={submit} className="panel max-w-xl space-y-4 p-5"><h2 className="text-sm font-semibold text-white">Change administrator password</h2><input className="field" type="password" name="currentPassword" required placeholder="Current password" autoComplete="current-password" /><input className="field" type="password" name="password" required minLength={8} placeholder="New password" autoComplete="new-password" /><input className="field" type="password" name="confirmPassword" required minLength={8} placeholder="Confirm new password" autoComplete="new-password" /><button className="secondary-btn">Change password</button>{message && <p className="text-xs text-slate-400">{message}</p>}</form>
}
