import { redirect } from 'next/navigation'
import { Brand } from '@/components/brand'
import { getCurrentUser } from '@/lib/auth'

function isNextRedirect(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest: unknown }).digest === 'string' &&
      String((error as { digest: string }).digest).startsWith('NEXT_REDIRECT'),
  )
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  try {
    if (await getCurrentUser()) redirect('/dashboard')
  } catch (error) {
    if (isNextRedirect(error)) throw error
  }
  return <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]"><section className="relative hidden overflow-hidden border-r border-white/10 p-12 lg:flex lg:flex-col"><Brand /><div className="my-auto max-w-xl"><p className="text-xs font-semibold uppercase tracking-[.22em] text-cyan-300">Verified sources. Real workflows.</p><h2 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-.055em] text-white">Find the inboxes hiding in plain sight.</h2><p className="mt-6 max-w-lg text-base leading-7 text-slate-400">Ghost Mail Finder scans public web pages, records every source, and turns domain lists into actionable contact intelligence.</p><div className="mt-9 grid grid-cols-3 gap-3">{['Public sources', 'Credit controls', 'Admin reviewed'].map((item) => <div key={item} className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-xs text-slate-300">{item}</div>)}</div></div><p className="text-xs text-slate-600">Only publicly available business contact information.</p><div className="pointer-events-none absolute -bottom-64 -left-32 size-[600px] rounded-full bg-cyan-300/[.06] blur-3xl" /></section><section className="flex min-h-screen items-center justify-center p-6 sm:p-12"><div className="absolute left-5 top-5 lg:hidden"><Brand /></div>{children}</section></main>
}
