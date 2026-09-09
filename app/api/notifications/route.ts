import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const user = await requireApiUser()
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ])
    return NextResponse.json({ notifications, unread })
  } catch (error) {
    return apiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireApiUser()
    const input = z.object({ ids: z.array(z.string().cuid()).max(100).optional(), all: z.boolean().optional() }).parse(await request.json())
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(!input.all ? { id: { in: input.ids || [] } } : {}),
      },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
