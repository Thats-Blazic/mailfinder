import { NextRequest, NextResponse } from 'next/server'
import { ApiError, apiError, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { savePaymentProof } from '@/lib/payment-proof'
import { paymentSubmissionSchema } from '@/lib/validation'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const user = await requireApiUser()
    const { id } = await context.params
    const contentType = request.headers.get('content-type') || ''

    let transactionHash: string | undefined
    let telegramHandle: string | undefined
    let screenshot: File | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const parsed = paymentSubmissionSchema.parse({
        transactionHash: String(form.get('transactionHash') || ''),
        telegramHandle: String(form.get('telegramHandle') || ''),
      })
      transactionHash = parsed.transactionHash || undefined
      telegramHandle = parsed.telegramHandle || undefined
      const file = form.get('screenshot')
      if (file instanceof File && file.size > 0) screenshot = file
    } else {
      const parsed = paymentSubmissionSchema.parse(await request.json())
      transactionHash = parsed.transactionHash || undefined
      telegramHandle = parsed.telegramHandle || undefined
    }

    if (!screenshot && !(transactionHash && transactionHash.length >= 8)) {
      throw new ApiError(400, 'Upload a payment screenshot or provide a transaction hash')
    }

    const payment = await prisma.payment.findFirst({ where: { id, userId: user.id } })
    if (!payment) throw new ApiError(404, 'Payment not found')
    if (!['PENDING', 'MORE_INFO_REQUIRED'].includes(payment.status)) {
      throw new ApiError(409, 'Payment cannot be updated')
    }
    if (payment.expiresAt <= new Date()) {
      await prisma.payment.update({ where: { id }, data: { status: 'EXPIRED' } })
      throw new ApiError(409, 'Payment request has expired')
    }

    if (transactionHash) {
      const duplicate = await prisma.payment.findFirst({
        where: {
          cryptocurrency: payment.cryptocurrency,
          transactionHash,
          id: { not: payment.id },
        },
      })
      if (duplicate) throw new ApiError(409, 'This transaction hash was already submitted')
    }

    const proofImage = screenshot ? await savePaymentProof(payment.id, screenshot) : payment.proofImage
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          transactionHash: transactionHash || payment.transactionHash,
          telegramHandle: telegramHandle || payment.telegramHandle,
          proofImage,
          status: 'PENDING',
        },
      })
      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'PAYMENT_SUBMITTED',
          title: 'Payment submitted',
          message: 'Your payment screenshot is awaiting manual verification.',
        },
      })
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_SUBMITTED',
          targetType: 'Payment',
          targetId: payment.id,
          metadata: { userId: user.id, cryptocurrency: payment.cryptocurrency, hasScreenshot: Boolean(proofImage) },
        },
      })
      return result
    })
    return NextResponse.json({ payment: updated })
  } catch (error) {
    return apiError(error)
  }
}
