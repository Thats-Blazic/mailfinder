import { describe, expect, it } from 'vitest'
import { pagePriority } from '@/lib/finder/crawler'

describe('priority crawling', () => {
  it('ranks contact, privacy, and terms pages highest', () => {
    expect(pagePriority('https://acme.com/contact')).toBe(100)
    expect(pagePriority('https://acme.com/contact-us')).toBe(100)
    expect(pagePriority('https://acme.com/en/contactus')).toBe(100)
    expect(pagePriority('https://acme.com/get-in-touch')).toBe(100)
    expect(pagePriority('https://acme.com/reach-us')).toBe(100)
    expect(pagePriority('https://acme.com/privacy')).toBe(100)
    expect(pagePriority('https://acme.com/privacy-policy')).toBe(100)
    expect(pagePriority('https://acme.com/terms')).toBe(100)
  })

  it('ranks about, team, support, then sales below contact', () => {
    const contact = pagePriority('https://acme.com/contact')
    const about = pagePriority('https://acme.com/about-us')
    const team = pagePriority('https://acme.com/our-team')
    const support = pagePriority('https://acme.com/customer-service')
    const sales = pagePriority('https://acme.com/sales')
    const other = pagePriority('https://acme.com/blog/hello')
    expect(contact).toBeGreaterThan(about)
    expect(about).toBeGreaterThan(team)
    expect(team).toBeGreaterThan(support)
    expect(support).toBeGreaterThan(sales)
    expect(sales).toBeGreaterThan(other)
  })

  it('uses anchor text when the URL is generic', () => {
    expect(pagePriority('https://acme.com/page', 'Contact us')).toBe(100)
    expect(pagePriority('https://acme.com/p/12', 'Our team')).toBe(60)
  })
})
