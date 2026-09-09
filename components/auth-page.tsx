import { Suspense } from 'react'
import { AuthForm } from '@/components/auth-form'

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
      <AuthForm mode={mode} />
    </Suspense>
  )
}
