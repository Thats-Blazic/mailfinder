import {
  CreditTransactionType,
  PaymentStatus,
  Prisma,
  UserPlanStatus,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/api'
import { getPaymentSettings } from '@/lib/settings'

type Tx = Prisma.TransactionClient

async function audit(
  tx: Tx,
  data: {
    adminId?: string
    action: string
    targetType: string
    targetId?: string
    metadata?: Prisma.InputJsonValue
    ipAddress?: string | null
  },
) {
  await tx.auditLog.create({
    data: {
      ...data,
      ipAddress: data.ipAddress || undefined,
    },
  })
}

export async function assignPlan(input: {
  userId: string
  planId: string
  adminId: string
  durationDays?: number
  reason: string
  ipAddress?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { id: input.planId } })
    if (!plan || !plan.active) throw new ApiError(404, 'Active plan not found')
    const durationDays = input.durationDays ?? plan.durationDays
    const expiresAt = new Date(Date.now() + durationDays * 86_400_000)

    await tx.userPlan.updateMany({
      where: { userId: input.userId, status: UserPlanStatus.ACTIVE },
      data: { status: UserPlanStatus.REVOKED },
    })
    const userPlan = await tx.userPlan.create({
      data: {
        userId: input.userId,
        planId: plan.id,
        creditsGranted: 0,
        expiresAt,
        assignedById: input.adminId,
      },
    })
    await tx.user.update({
      where: { id: input.userId },
      data: { status: 'ACTIVE' },
    })
    await tx.notification.create({
      data: {
        userId: input.userId,
        type: 'PLAN_ACTIVATED',
        title: `${plan.name} plan activated`,
        message: `Your ${plan.name} plan is now active until ${expiresAt.toLocaleDateString()}.`,
      },
    })
    await audit(tx, {
      adminId: input.adminId,
      action: 'PLAN_ASSIGNED',
      targetType: 'User',
      targetId: input.userId,
      metadata: { planId: plan.id, durationDays, reason: input.reason },
      ipAddress: input.ipAddress,
    })
    return userPlan
  })
}

export async function changeCredits(input: {
  userId: string
  adminId: string
  operation: 'ADD' | 'REMOVE' | 'RESET'
  amount: number
  reason: string
  ipAddress?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId } })
    if (!user) throw new ApiError(404, 'User not found')

    let delta = input.amount
    let type: CreditTransactionType = CreditTransactionType.ADMIN_ADD
    if (input.operation === 'REMOVE') {
      delta = -input.amount
      type = CreditTransactionType.ADMIN_REMOVE
      if (user.creditBalance < input.amount) throw new ApiError(409, 'Insufficient user credits')
    } else if (input.operation === 'RESET') {
      delta = input.amount - user.creditBalance
      type = CreditTransactionType.ADMIN_RESET
    }

    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: { increment: delta } },
    })
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        amount: delta,
        type,
        reason: input.reason,
        adminId: input.adminId,
      },
    })
    await audit(tx, {
      adminId: input.adminId,
      action: `CREDITS_${input.operation}`,
      targetType: 'User',
      targetId: input.userId,
      metadata: { amount: input.amount, delta, reason: input.reason },
      ipAddress: input.ipAddress,
    })
    return updated
  })
}

export async function createPaymentRequest(userId: string, planId: string, cryptocurrency: string) {
  const [plan, settings] = await Promise.all([
    prisma.plan.findUnique({ where: { id: planId } }),
    getPaymentSettings(),
  ])
  if (!plan || !plan.active) throw new ApiError(404, 'Plan not found')

  const crypto = settings.cryptocurrencies[cryptocurrency]
  if (!crypto?.enabled || !crypto.address) throw new ApiError(400, 'Cryptocurrency is not enabled')
  const configuredPrices = (plan.cryptoPrice || {}) as Record<string, number>
  const amount = configuredPrices[cryptocurrency]
  if (!amount || amount <= 0) {
    throw new ApiError(409, `No exact ${cryptocurrency} price is configured for this plan`)
  }

  return prisma.payment.create({
    data: {
      userId,
      planId,
      cryptocurrency,
      amount,
      walletAddress: crypto.address,
      expiresAt: new Date(Date.now() + settings.expirationMinutes * 60_000),
    },
    include: { plan: true },
  })
}

export async function reviewPayment(input: {
  paymentId: string
  adminId: string
  action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO'
  adminNote?: string
  ipAddress?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: { plan: true },
    })
    if (!payment) throw new ApiError(404, 'Payment not found')
    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.MORE_INFO_REQUIRED
    ) {
      throw new ApiError(409, 'Payment was already reviewed')
    }

    if (input.action !== 'APPROVE') {
      const status =
        input.action === 'REJECT' ? PaymentStatus.REJECTED : PaymentStatus.MORE_INFO_REQUIRED
      const updated = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.MORE_INFO_REQUIRED] },
        },
        data: { status, adminNote: input.adminNote, reviewedAt: new Date(), reviewedById: input.adminId },
      })
      if (updated.count !== 1) throw new ApiError(409, 'Payment was already reviewed')
      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_REJECTED',
          title: input.action === 'REJECT' ? 'Payment rejected' : 'Payment needs more information',
          message: input.adminNote || 'An administrator reviewed your payment submission.',
        },
      })
      await audit(tx, {
        adminId: input.adminId,
        action: input.action === 'REJECT' ? 'PAYMENT_REJECTED' : 'PAYMENT_INFO_REQUESTED',
        targetType: 'Payment',
        targetId: payment.id,
        metadata: { note: input.adminNote || null },
        ipAddress: input.ipAddress,
      })
      return updated
    }

    if (!payment.transactionHash && !payment.proofImage) {
      throw new ApiError(409, 'A payment screenshot or transaction hash is required before approval')
    }
    if (payment.expiresAt <= new Date()) throw new ApiError(409, 'Payment request has expired')

    const claimed = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.MORE_INFO_REQUIRED] },
      },
      data: {
        status: PaymentStatus.APPROVED,
        adminNote: input.adminNote,
        reviewedAt: new Date(),
        reviewedById: input.adminId,
      },
    })
    if (claimed.count !== 1) throw new ApiError(409, 'Payment was already reviewed')
    await tx.userPlan.updateMany({
      where: { userId: payment.userId, status: UserPlanStatus.ACTIVE },
      data: { status: UserPlanStatus.REVOKED },
    })
    const expiresAt = new Date(Date.now() + payment.plan.durationDays * 86_400_000)
    await tx.userPlan.create({
      data: {
        userId: payment.userId,
        planId: payment.planId,
        creditsGranted: 0,
        expiresAt,
        assignedById: input.adminId,
        paymentId: payment.id,
      },
    })
    await tx.user.update({
      where: { id: payment.userId },
      data: { status: 'ACTIVE' },
    })
    await tx.notification.createMany({
      data: [
        {
          userId: payment.userId,
          type: 'PAYMENT_APPROVED',
          title: 'Payment approved',
          message: 'Your cryptocurrency payment screenshot was verified.',
        },
        {
          userId: payment.userId,
          type: 'PLAN_ACTIVATED',
          title: `${payment.plan.name} plan activated`,
          message: `Your ${payment.plan.name} plan is now active until ${expiresAt.toLocaleDateString()}.`,
        },
      ],
    })
    await audit(tx, {
      adminId: input.adminId,
      action: 'PAYMENT_APPROVED',
      targetType: 'Payment',
      targetId: payment.id,
      metadata: { userId: payment.userId, planId: payment.planId },
      ipAddress: input.ipAddress,
    })
    return payment
  })
}
