import Link from 'next/link'
import { Ghost } from 'lucide-react'
import { Brand } from '@/components/brand'

export default function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-lg text-center"><Brand /><div className="panel mt-8 p-9"><Ghost className="mx-auto size-10 text-cyan-300" /><p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-slate-600">404 · Not found</p><h1 className="mt-2 text-2xl font-semibold text-white">This page vanished</h1><p className="mt-3 text-sm text-slate-400">The requested Ghost Mail Finder resource does not exist or is not available to your account.</p><Link href="/dashboard" className="primary-btn mt-6">Return to dashboard</Link></div></div></main>
}
