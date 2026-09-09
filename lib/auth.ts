import 'server-only'

import { createHmac, randomBytes } from 'node:crypto'
import { AccountStatus, UserRole } from '@prisma/client'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { isPlanUsable } from '@/lib/plans'
export { hashPassword, verifyPassword } from '@/lib/password'

const SESSION_COOKIE = 'ghost_session'

function hashToken(token: string) {
  return createHmac('sha256', getEnv().AUTH_SECRET).update(token).digest('hex')
}

export async function createSession(userId: string) {
  const { SESSION_TTL_DAYS } = getEnv()
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(SESSION_COOKIE)
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          plans: {
            where: { status: 'ACTIVE' },
            include: { plan: true },
            orderBy: { expiresAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } })
    return null
  }

  if (session.user.status === AccountStatus.DISABLED) return null

  const activePlan = session.user.plans[0]
  if (activePlan && !isPlanUsable(activePlan)) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.userPlan.updateMany({
        where: { id: activePlan.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      })
      if (!changed.count) return
      await tx.user.update({
        where: { id: session.user.id },
        data: { status: 'INACTIVE' },
      })
      await tx.notification.create({
        data: {
          userId: session.user.id,
          type: 'PLAN_EXPIRED',
          title: 'Plan expired',
          message: 'Your Ghost Mail Finder plan has expired. Contact an administrator to reactivate access.',
        },
      })
    })
    session.user.plans = []
  }

  return session.user
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== UserRole.ADMIN) redirect('/dashboard')
  return user
}

export async function getApiUser() {
  return getCurrentUser()
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    }),
  ])
  return token
}

export function passwordResetTokenHash(token: string) {
  return hashToken(token)
}
