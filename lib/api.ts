import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getApiUser } from '@/lib/auth'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function requireApiUser(role?: UserRole) {
  const user = await getApiUser()
  if (!user) throw new ApiError(401, 'Authentication required')
  if (role && user.role !== role) throw new ApiError(403, 'Forbidden')
  return user
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host && new URL(origin).host !== host) {
    throw new ApiError(403, 'Invalid request origin')
  }
}

export function clientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
  }
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  if (current.count >= limit) throw new ApiError(429, 'Too many requests')
  current.count += 1
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
    return NextResponse.json({ error: 'A unique value is already in use' }, { status: 409 })
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || 'Invalid request' },
      { status: 400 },
    )
  }
  console.error(error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
