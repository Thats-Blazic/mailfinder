import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { reviewPayment } from '@/lib/services'
import { paymentReviewSchema } from '@/lib/validation'

const paramsSchema = z.object({ id: z.string().cuid() })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const input = paymentReviewSchema.parse(await request.json())
    await reviewPayment({
      paymentId: id,
      adminId: admin.id,
      ...input,
      ipAddress: clientIp(request),
    })
    const payment = await prisma.payment.findUnique({ where: { id } })
    return NextResponse.json({ payment })
  } catch (error) {
    return apiError(error)
  }
}
