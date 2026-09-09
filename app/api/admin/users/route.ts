import { AccountStatus, UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(254).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams))
    const where = {
      ...(query.status && { status: query.status }),
      ...(query.role && { role: query.role }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          creditBalance: true,
          creditsUsed: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          plans: {
            where: { status: 'ACTIVE' },
            orderBy: { expiresAt: 'desc' },
            take: 1,
            include: { plan: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ])
    return NextResponse.json({
      users,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(total / query.pageSize),
      total,
    })
  } catch (error) {
    return apiError(error)
  }
}
