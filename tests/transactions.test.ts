import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    payment: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    plan: { findUnique: vi.fn() },
    userPlan: { updateMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    creditTransaction: { create: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  }
  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  }
})

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/settings', () => ({ getPaymentSettings: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getApiUser: vi.fn() }))

import { changeCredits, reviewPayment } from '@/lib/services'

describe('atomic payment and credit operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx))
  })

  it('approves payment, activates plan, notifies, and audits in one transaction', async () => {
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      planId: 'plan-1',
      cryptocurrency: 'ETH',
      transactionHash: '0xconfirmed',
      proofImage: 'uploads/payments/payment-1.jpg',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      plan: { name: 'PRO', credits: 25_000, durationDays: 30 },
    })
    await reviewPayment({ paymentId: 'payment-1', adminId: 'admin-1', action: 'APPROVE' })

    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    )
    expect(mocks.tx.userPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creditsGranted: 0, planId: 'plan-1' }) }),
    )
    expect(mocks.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    )
    expect(mocks.tx.creditTransaction.create).not.toHaveBeenCalled()
    expect(mocks.tx.notification.createMany).toHaveBeenCalled()
    expect(mocks.tx.auditLog.create).toHaveBeenCalled()
  })

  it('rejects payment without activating a plan or granting credits', async () => {
    mocks.tx.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      status: 'PENDING',
      plan: { name: 'PRO', credits: 25_000, durationDays: 30 },
    })
    await reviewPayment({ paymentId: 'payment-1', adminId: 'admin-1', action: 'REJECT' })

    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
    )
    expect(mocks.tx.userPlan.create).not.toHaveBeenCalled()
    expect(mocks.tx.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('records every administrator credit balance change in the ledger and audit log', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ id: 'user-1', creditBalance: 100 })
    mocks.tx.user.update.mockResolvedValue({ id: 'user-1', creditBalance: 150 })
    await changeCredits({
      userId: 'user-1',
      adminId: 'admin-1',
      operation: 'ADD',
      amount: 50,
      reason: 'Manual compensation',
    })
    expect(mocks.tx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 50,
          type: 'ADMIN_ADD',
          reason: 'Manual compensation',
        }),
      }),
    )
    expect(mocks.tx.auditLog.create).toHaveBeenCalled()
  })
})
