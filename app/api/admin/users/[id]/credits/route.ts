import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { changeCredits } from '@/lib/services'
import { creditChangeSchema } from '@/lib/validation'

const paramsSchema = z.object({ id: z.string().cuid() })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const input = creditChangeSchema.parse(await request.json())
    const user = await changeCredits({
      userId: id,
      adminId: admin.id,
      ...input,
      ipAddress: clientIp(request),
    })
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        creditBalance: user.creditBalance,
        creditsUsed: user.creditsUsed,
        updatedAt: user.updatedAt,
      },
    })
  } catch (error) {
    return apiError(error)
  }
}
