import { timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/db'
import { processSearchChunk } from '@/lib/finder/processor'

export const maxDuration = 60
export const runtime = 'nodejs'

function authorized(request: NextRequest) {
  const secret = process.env.AUTH_SECRET
  const header = request.headers.get('x-scan-secret')
  if (!secret || !header) return false
  const expected = Buffer.from(secret)
  const actual = Buffer.from(header)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureDatabase()
    const body = (await request.json().catch(() => ({}))) as { searchId?: string }
    const searchId = body.searchId
    if (!searchId) return NextResponse.json({ error: 'Missing searchId' }, { status: 400 })

    const more = await processSearchChunk(searchId, Date.now() + 8_000)
    if (more) {
      after(async () => {
        await fetch(request.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-scan-secret': process.env.AUTH_SECRET || '',
          },
          body: JSON.stringify({ searchId }),
        })
      })
    }
    return NextResponse.json({ ok: true, more })
  } catch (error) {
    console.error('Scan continuation failed', error)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
