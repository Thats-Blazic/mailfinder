import { NextRequest, NextResponse } from 'next/server'
import {
  destroySession,
  hashPassword,
  passwordResetTokenHash,
} from '@/lib/auth'
import { ApiError, apiError, clientIp, rateLimit, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { resetPasswordSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    rateLimit(`auth:reset:${clientIp(request) ?? 'unknown'}`, 5, 15 * 60 * 1000)

    const input = resetPasswordSchema.parse(await request.json())
    const tokenHash = passwordResetTokenHash(input.token)
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    })

    if (!resetToken) throw new ApiError(400, 'Invalid or expired reset token')

    const passwordHash = await hashPassword(input.password)
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      })

      if (claimed.count !== 1) throw new ApiError(400, 'Invalid or expired reset token')

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      })
      await tx.session.deleteMany({ where: { userId: resetToken.userId } })
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
          usedAt: null,
        },
      })
    })

    await destroySession()
    return NextResponse.json({ message: 'Password reset successfully' })
  } catch (error) {
    return apiError(error)
  }
}
