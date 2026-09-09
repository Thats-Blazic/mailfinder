import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createXlsx } from '@/lib/xlsx'

describe('XLSX export', () => {
  it('creates an Office Open XML workbook with escaped result data', () => {
    const archive = unzipSync(createXlsx(['Domain', 'Email'], [{ Domain: 'a&b.example', Email: 'hi@example.com' }]))
    expect(Object.keys(archive)).toContain('xl/worksheets/sheet1.xml')
    const sheet = strFromU8(archive['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('a&amp;b.example')
    expect(sheet).toContain('hi@example.com')
  })
})
