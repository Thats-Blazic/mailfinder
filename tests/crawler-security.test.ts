import { describe, expect, it } from 'vitest'
import { assertPublicUrl, crawlDomain, isPrivateAddress } from '@/lib/finder/crawler'

describe('crawler SSRF protection and errors', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.2',
    '172.16.1.2',
    '192.168.1.2',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('blocks private address %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it('rejects local targets before fetching', async () => {
    await expect(assertPublicUrl(new URL('http://localhost/'))).rejects.toThrow(/Local/)
    await expect(assertPublicUrl(new URL('http://127.0.0.1/'))).rejects.toThrow(/Local/)
  })

  it('surfaces crawler failures without fabricating results', async () => {
    await expect(
      crawlDomain('localhost', { maxPages: 1, timeoutMs: 100, mode: 'FAST' }),
    ).rejects.toThrow()
  })
})
