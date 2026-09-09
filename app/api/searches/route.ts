import { NextRequest, NextResponse } from 'next/server'
import { apiError, clientIp, rateLimit, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { createSearch } from '@/lib/searches'
import { createSearchSchema } from '@/lib/validation'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser()
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1))
    const take = 20
    const [searches, total] = await Promise.all([
      prisma.search.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      prisma.search.count({ where: { userId: user.id } }),
    ])
    return NextResponse.json({ searches, page, pages: Math.ceil(total / take), total })
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireApiUser()
    rateLimit(`search:${user.id}:${clientIp(request) || 'unknown'}`, 10, 60_000)
    const input = createSearchSchema.parse(await request.json())
    const result = await createSearch({ userId: user.id, ...input })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
