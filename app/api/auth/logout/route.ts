import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'
import { apiError, clientIp, rateLimit, requireSameOrigin } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    rateLimit(`auth:logout:${clientIp(request) ?? 'unknown'}`, 30, 60 * 1000)
    await destroySession()
    return NextResponse.redirect(new URL('/login', request.url), 303)
  } catch (error) {
    return apiError(error)
  }
}
