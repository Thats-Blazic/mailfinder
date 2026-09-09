import { NextRequest, NextResponse } from 'next/server'
import { createPasswordResetToken } from '@/lib/auth'
import { apiError, clientIp, rateLimit, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { sendPasswordReset } from '@/lib/email'
import { forgotPasswordSchema } from '@/lib/validation'

const GENERIC_RESPONSE = {
  message: 'If an account exists for that email, password reset instructions will be sent.',
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    rateLimit(`auth:forgot:${clientIp(request) ?? 'unknown'}`, 5, 15 * 60 * 1000)

    const input = forgotPasswordSchema.parse(await request.json())
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, status: true },
    })

    if (user && user.status !== 'DISABLED') {
      const token = await createPasswordResetToken(user.id)
      try {
        await sendPasswordReset(input.email, token)
      } catch (error) {
        // Preserve account enumeration resistance while retaining an actionable server error.
        console.error('Password reset delivery failed', error)
      }
    }

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (error) {
    return apiError(error)
  }
}
