import { NextRequest, NextResponse } from 'next/server'
import { apiError, clientIp, rateLimit, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { createPaymentRequest } from '@/lib/services'
import { paymentRequestSchema } from '@/lib/validation'

export async function GET() {
  try {
    const user = await requireApiUser()
    const payments = await prisma.payment.findMany({
      where: { userId: user.id },
      include: { plan: { select: { name: true, credits: true, durationDays: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ payments })
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireApiUser()
    rateLimit(`payment:${user.id}:${clientIp(request) || 'unknown'}`, 10, 60 * 60_000)
    const input = paymentRequestSchema.parse(await request.json())
    const payment = await createPaymentRequest(user.id, input.planId, input.cryptocurrency)
    return NextResponse.json(
      {
        payment: {
          id: payment.id,
          amount: payment.amount.toString(),
          cryptocurrency: payment.cryptocurrency,
          walletAddress: payment.walletAddress,
          expiresAt: payment.expiresAt,
          plan: payment.plan,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return apiError(error)
  }
}
