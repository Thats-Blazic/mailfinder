import Link from 'next/link'
import { Ghost, Mail } from 'lucide-react'

export function Brand({ compact = false, href = '/' }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-3" aria-label="Ghost Mail Finder home">
      <span className="relative grid size-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,.08)]">
        <Ghost className="size-5 transition-transform group-hover:-translate-y-0.5" />
        <Mail className="absolute -bottom-1 -right-1 size-3 rounded bg-[#10151e] p-0.5" />
      </span>
      {!compact && (
        <span>
          <span className="block text-sm font-semibold tracking-tight text-white">Ghost Mail Finder</span>
          <span className="block text-[10px] uppercase tracking-[.22em] text-cyan-300/70">Public email intelligence</span>
        </span>
      )}
    </Link>
  )
}
