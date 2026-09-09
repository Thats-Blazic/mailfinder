'use client'

import { AlertTriangle } from 'lucide-react'
import { Brand } from '@/components/brand'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center p-6"><div className="w-full max-w-lg text-center"><Brand /><div className="panel mt-8 p-8"><AlertTriangle className="mx-auto size-8 text-rose-300" /><h1 className="mt-5 text-xl font-semibold text-white">Something slipped into the shadows</h1><p className="mt-2 text-sm leading-6 text-slate-400">{error.message || 'Ghost Mail Finder could not load this view.'}</p><button onClick={reset} className="primary-btn mt-6">Try again</button></div></div></main>
}
