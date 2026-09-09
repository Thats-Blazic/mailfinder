'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Bell, BookOpen, ChevronRight, CircleDollarSign, CreditCard, FileClock, Ghost, LayoutDashboard, Menu, Search, Settings, Shield, Users, X } from 'lucide-react'
import { Brand } from '@/components/brand'

const userNav = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/finder', 'Finder', Search],
  ['/results', 'Results', FileClock],
  ['/billing', 'Billing', CreditCard],
  ['/notifications', 'Notifications', Bell],
  ['/documentation', 'Documentation', BookOpen],
] as const

const adminNav = [
  ['/admin', 'Overview', LayoutDashboard],
  ['/admin/users', 'Users', Users],
  ['/admin/plans', 'Plans', Shield],
  ['/admin/payments', 'Payments', CircleDollarSign],
  ['/admin/searches', 'Searches', Search],
  ['/admin/settings', 'Settings', Settings],
  ['/admin/audit-logs', 'Audit logs', FileClock],
] as const

export function AppShell({ children, user, admin = false }: {
  children: React.ReactNode
  user: { name: string; email: string; role: string; planName?: string; planExpiresAt?: string }
  admin?: boolean
}) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const nav = admin ? adminNav : userNav
  const initials = user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="min-h-screen lg:flex">
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-white/10 bg-[#0c1119] p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center justify-between px-2"><Brand /><button className="icon-btn lg:hidden" onClick={() => setOpen(false)} aria-label="Close"><X className="size-4" /></button></div>
        {admin && <div className="mx-2 mt-5 flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[.15em] text-violet-300"><Ghost className="size-3.5" /> Admin command</div>}
        <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-600">{admin ? 'Administration' : 'Workspace'}</p>
        <nav className="space-y-1">
          {nav.map(([href, label, Icon]) => {
            const active = href === '/admin' ? path === href : path === href || path.startsWith(`${href}/`)
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active ? 'bg-cyan-300/10 text-cyan-200' : 'text-slate-400 hover:bg-white/[.04] hover:text-white'}`}><Icon className="size-4" /><span className="flex-1">{label}</span>{active && <ChevronRight className="size-3.5" />}</Link>
          })}
        </nav>
        <div className="mt-auto space-y-3">
          {!admin && (
            <div className="rounded-xl border border-white/10 bg-white/[.025] p-4">
              <div className="text-xs text-slate-500">Current plan</div>
              <div className="mt-1 text-xl font-semibold text-white">{user.planName || 'No plan'}</div>
              <div className="mt-3 flex justify-between text-[11px]">
                <span className="text-cyan-300">{user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : 'Inactive'}</span>
                <Link href="/billing" className="text-slate-400 hover:text-white">Manage</Link>
              </div>
            </div>
          )}
          {admin ? <Link href="/dashboard" className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white">Return to workspace</Link> : user.role === 'ADMIN' && <Link href="/admin" className="flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-xs text-violet-300"><Shield className="size-3.5" />Open admin command</Link>}
          <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4"><span className="grid size-9 place-items-center rounded-full bg-cyan-300/10 text-xs font-semibold text-cyan-300">{initials}</span><span className="min-w-0 flex-1"><b className="block truncate text-xs font-medium text-white">{user.name}</b><span className="block truncate text-[11px] text-slate-500">{user.email}</span></span><form action="/api/auth/logout" method="post"><button className="text-[11px] text-slate-500 hover:text-white">Log out</button></form></div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-white/10 bg-[#0a0f17]/85 px-4 backdrop-blur-xl sm:px-7">
          <button className="icon-btn mr-3 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></button>
          <span className="text-xs text-slate-500">{admin ? 'Admin' : 'Ghost workspace'} <span className="mx-2 text-slate-700">/</span><span className="text-slate-300">{[...nav].reverse().find(([href]) => path === href || path.startsWith(`${href}/`))?.[1] || 'Page'}</span></span>
          <Link href="/notifications" className="icon-btn ml-auto" aria-label="Notifications"><Bell className="size-4" /></Link>
        </header>
        <div className="mx-auto max-w-[1440px] p-4 sm:p-7 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
