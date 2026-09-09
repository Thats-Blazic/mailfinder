import { describe, expect, it } from 'vitest'
import { normalizeDomain, processDomainInput } from '@/lib/finder/domains'

describe('domain validation', () => {
  it('normalizes public hostnames and URLs', () => {
    expect(normalizeDomain('HTTPS://WWW.Example.com/contact?q=1')).toBe('example.com')
    expect(normalizeDomain('sub.example.co.uk')).toBe('sub.example.co.uk')
  })

  it('rejects IPs, credentials, ports, and malformed domains', () => {
    expect(normalizeDomain('127.0.0.1')).toBeNull()
    expect(normalizeDomain('https://user:pass@example.com')).toBeNull()
    expect(normalizeDomain('example.com:8080')).toBeNull()
    expect(normalizeDomain('localhost')).toBeNull()
  })

  it('removes duplicates and reports invalid values', () => {
    expect(processDomainInput(['example.com', 'www.example.com', 'bad', 'acme.io'])).toEqual({
      domains: ['example.com', 'acme.io'],
      invalid: ['bad'],
      duplicates: 1,
    })
  })
})
