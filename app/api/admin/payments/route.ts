import { PaymentStatus, UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(PaymentStatus).optional(),
  search: z.string().trim().max(254).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams))
    const where = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { transactionHash: { contains: query.search, mode: 'insensitive' as const } },
          { user: { name: { contains: query.search, mode: 'insensitive' as const } } },
          { user: { email: { contains: query.search, mode: 'insensitive' as const } } },
        ],
      }),
    }
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
          plan: true,
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.payment.count({ where }),
    ])
    return NextResponse.json({
      payments,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(total / query.pageSize),
      total,
    })
  } catch (error) {
    return apiError(error)
  }
}
