import { NextRequest, NextResponse } from 'next/server'
import { ApiError, apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'
import { createXlsx } from '@/lib/xlsx'

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser()
    const { id } = await context.params
    const formatParam = request.nextUrl.searchParams.get('format')
    const format = formatParam === 'xlsx' ? 'xlsx' : formatParam === 'txt' ? 'txt' : 'csv'
    const search = await prisma.search.findFirst({
      where: { id, userId: user.id },
      include: {
        domains: {
          include: { results: { orderBy: { foundAt: 'asc' } } },
          orderBy: { hostname: 'asc' },
        },
      },
    })
    if (!search) throw new ApiError(404, 'Search not found')

    const rows = search.domains.flatMap((domain) =>
      domain.results.map((result) => ({
        Domain: domain.hostname,
        Email: result.email,
        'Email Type': result.emailType,
        'Source URL': result.sourceUrl,
        'Source Type': result.sourceType,
        Confidence: result.confidence,
        Status: result.status,
        'Found At': result.foundAt.toISOString(),
      })),
    )
    const filename = search.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'results'
    const columns = ['Domain', 'Email', 'Email Type', 'Source URL', 'Source Type', 'Confidence', 'Status', 'Found At']

    if (format === 'txt') {
      const emails = [...new Set(rows.map((row) => row.Email).filter(Boolean))].sort((a, b) => a.localeCompare(b))
      return new NextResponse(emails.join('\n'), {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}-emails.txt"`,
          'cache-control': 'private, no-store',
        },
      })
    }

    if (format === 'xlsx') {
      const body = createXlsx(columns, rows)
      return new NextResponse(body, {
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="${filename}.xlsx"`,
          'cache-control': 'private, no-store',
        },
      })
    }
    const csv = [
      columns.map(csvCell).join(','),
      ...rows.map((row) => columns.map((column) => csvCell(row[column as keyof typeof row])).join(',')),
    ].join('\r\n')
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}.csv"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    return apiError(error)
  }
}
