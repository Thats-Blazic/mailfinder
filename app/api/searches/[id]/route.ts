import { NextResponse } from 'next/server'
import { ApiError, apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'
import { ensureSearchRunning } from '@/lib/finder/processor'

export const maxDuration = 60

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser()
    const { id } = await context.params
    const search = await prisma.search.findFirst({
      where: { id, userId: user.id },
      include: {
        domains: {
          orderBy: { hostname: 'asc' },
          select: { id: true, hostname: true, status: true, error: true, pagesScanned: true },
        },
      },
    })
    if (!search) throw new ApiError(404, 'Search not found')
    if (['QUEUED', 'PROCESSING'].includes(search.status)) ensureSearchRunning(search.id)
    return NextResponse.json({ search })
  } catch (error) {
    return apiError(error)
  }
}
