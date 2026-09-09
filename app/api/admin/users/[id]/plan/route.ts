import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { assignPlan } from '@/lib/services'
import { assignPlanSchema } from '@/lib/validation'

const paramsSchema = z.object({ id: z.string().cuid() })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const input = assignPlanSchema.parse(await request.json())
    const userPlan = await assignPlan({
      userId: id,
      adminId: admin.id,
      ...input,
      ipAddress: clientIp(request),
    })
    return NextResponse.json({ userPlan }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
