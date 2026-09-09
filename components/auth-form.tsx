'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

const copy = {
  login: ['Welcome back', 'Sign in to continue discovering public business emails.', 'Sign in'],
  register: ['Create your account', 'Start your Ghost Mail Finder workspace.', 'Create account'],
  forgot: ['Reset your password', 'We will send a secure recovery link if the account exists.', 'Send recovery link'],
  reset: ['Choose a new password', 'Use at least 8 characters, one uppercase letter and one number.', 'Update password'],
} as const

export function AuthForm({ mode }: { mode: Mode }) {
  const params = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean }>()
  const [showPassword, setShowPassword] = useState(false)
  const [title, description, submitLabel] = copy[mode]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage(undefined)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    if (mode === 'reset') data.token = params.get('token') || ''
    try {
      const response = await fetch(`/api/auth/${mode === 'forgot' ? 'forgot-password' : mode === 'reset' ? 'reset-password' : mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to complete your request')
      if (mode === 'login' || mode === 'register' || mode === 'reset') {
        window.location.assign('/dashboard')
        return
      }
      else setMessage({ text: payload.message || 'Check your inbox for the next step.' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Something went wrong', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-cyan-300">Secure access</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      {(params.get('registered') || params.get('reset')) && <div className="notice mt-5">Your account is ready. Sign in to continue.</div>}
      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === 'register' && <Field label="Full name" name="name" autoComplete="name" placeholder="Ada Lovelace" />}
        {mode !== 'reset' && <Field label="Email address" name="email" type="email" autoComplete="email" placeholder="you@company.com" />}
        {(mode === 'login' || mode === 'register' || mode === 'reset') && (
          <>
            <Field label="Password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" />
            {mode !== 'login' && <Field label="Confirm password" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" />}
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="accent-cyan-300" />
              Show password
            </label>
          </>
        )}
        {mode === 'register' && (
          <p className="text-xs leading-5 text-slate-500">
            Password must be at least 8 characters and include one uppercase letter and one number.
          </p>
        )}
        {message && <div role="alert" className={message.error ? 'notice notice-error' : 'notice'}>{message.text}</div>}
        <button disabled={busy || (mode === 'reset' && !params.get('token'))} className="primary-btn w-full">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <>{submitLabel}<ArrowRight className="size-4" /></>}</button>
      </form>
      <div className="mt-6 flex justify-between text-xs text-slate-500">
        {mode === 'login' ? <><Link href="/register">Create account</Link><Link href="/forgot-password">Forgot password?</Link></> : <Link href="/login">Back to sign in</Link>}
      </div>
    </div>
  )
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props
  return <label className="block"><span className="mb-2 block text-xs font-medium text-slate-300">{label}</span><input required className="field" {...inputProps} /></label>
}
