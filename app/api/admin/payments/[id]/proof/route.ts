import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'
import { proofContentType, readPaymentProof } from '@/lib/payment-proof'

const paramsSchema = z.object({ id: z.string().min(1) })

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const payment = await prisma.payment.findUnique({ where: { id }, select: { proofImage: true } })
    if (!payment?.proofImage) throw new ApiError(404, 'Payment screenshot not found')
    const file = await readPaymentProof(payment.proofImage)
    return new NextResponse(Uint8Array.from(file), {
      headers: {
        'Content-Type': proofContentType(payment.proofImage),
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    return apiError(error)
  }
}
