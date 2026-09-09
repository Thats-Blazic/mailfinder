import { UserRole } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'

const paramsSchema = z.object({ id: z.string().cuid() })

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        creditBalance: true,
        creditsUsed: true,
        lastLoginAt: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
        plans: { include: { plan: true, assignedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
        payments: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        searches: { orderBy: { createdAt: 'desc' }, take: 20 },
        creditTransactions: {
          include: { admin: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })
    if (!user) throw new ApiError(404, 'User not found')
    return NextResponse.json({ user })
  } catch (error) {
    return apiError(error)
  }
}
