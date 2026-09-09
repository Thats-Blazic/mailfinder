import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  adminId: z.string().cuid().optional(),
  action: z.string().trim().max(100).optional(),
  targetType: z.string().trim().max(100).optional(),
  targetId: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams))
    const where = {
      ...(query.adminId && { adminId: query.adminId }),
      ...(query.action && { action: { contains: query.action, mode: 'insensitive' as const } }),
      ...(query.targetType && { targetType: query.targetType }),
      ...(query.targetId && { targetId: query.targetId }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: query.from }),
          ...(query.to && { lte: query.to }),
        },
      }),
    }
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { admin: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])
    return NextResponse.json({
      logs,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(total / query.pageSize),
      total,
    })
  } catch (error) {
    return apiError(error)
  }
}
