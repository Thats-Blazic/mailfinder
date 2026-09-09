import { NextRequest, NextResponse } from 'next/server'
import { ApiError, apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser()
    const { id } = await context.params
    const search = await prisma.search.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!search) throw new ApiError(404, 'Search not found')

    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1))
    const take = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 25)))
    const query = request.nextUrl.searchParams.get('q')?.trim()
    const type = request.nextUrl.searchParams.get('type')?.trim()
    const where = {
      domain: { searchId: id },
      ...(type ? { emailType: type } : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' as const } },
              { domain: { hostname: { contains: query, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }
    const [results, total] = await Promise.all([
      prisma.emailResult.findMany({
        where,
        include: { domain: { select: { hostname: true } } },
        orderBy: { foundAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      prisma.emailResult.count({ where }),
    ])
    return NextResponse.json({ results, page, pages: Math.ceil(total / take), total })
  } catch (error) {
    return apiError(error)
  }
}
