import { AppShell } from '@/components/app-shell'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const activePlan = user.plans[0]
  return <AppShell user={{ name: user.name, email: user.email, role: user.role, planName: activePlan?.plan.name, planExpiresAt: activePlan?.expiresAt.toISOString() }}>{children}</AppShell>
}
