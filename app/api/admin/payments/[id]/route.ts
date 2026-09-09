import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'

const paramsSchema = z.object({ id: z.string().cuid() })

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            creditBalance: true,
            createdAt: true,
          },
        },
        plan: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
        activatedPlan: true,
      },
    })
    if (!payment) throw new ApiError(404, 'Payment not found')
    return NextResponse.json({ payment })
  } catch (error) {
    return apiError(error)
  }
}
