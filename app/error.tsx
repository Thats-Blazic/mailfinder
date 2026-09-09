'use client'

import { AlertTriangle } from 'lucide-react'
import { Brand } from '@/components/brand'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const hidden = /minified react error|server components render/i.test(error.message || '')
  const message = hidden
    ? 'The database is not ready on Vercel. Set DATABASE_URL to a Neon Postgres URL, then Redeploy. Until then, open /login.'
    : error.message || 'Ghost Mail Finder could not load this view.'

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-lg text-center">
        <Brand href="/login" />
        <div className="panel mt-8 p-8">
          <AlertTriangle className="mx-auto size-8 text-rose-300" />
          <h1 className="mt-5 text-xl font-semibold text-white">Something slipped into the shadows</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
          <button onClick={reset} className="primary-btn mt-6">Try again</button>
        </div>
      </div>
    </main>
  )
}
