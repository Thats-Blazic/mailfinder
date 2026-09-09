import { describe, expect, it } from 'vitest'
import { extractEmails } from '@/lib/finder/extractor'

describe('source email extraction', () => {
  it('extracts mailto, visible, script, JSON-LD, and metadata addresses', () => {
    const html = `
      <meta name="contact" content="meta@example.com">
      <a href="mailto:sales@example.com?subject=Hello">Email us</a>
      <p>Visible: hello@example.com</p>
      <script type="application/ld+json">{"email":"team@example.com"}</script>
      <script>window.support = "support@example.com"</script>
    `
    const results = extractEmails(html, 'https://example.com/contact')
    expect(results.map((entry) => entry.email).sort()).toEqual([
      'hello@example.com',
      'meta@example.com',
      'sales@example.com',
      'support@example.com',
      'team@example.com',
    ])
    expect(results.find((entry) => entry.email === 'sales@example.com')?.sourceType).toBe('MAILTO')
  })

  it('normalizes duplicates and ignores asset-like false positives', () => {
    const results = extractEmails(
      '<p>HELLO@EXAMPLE.COM hello@example.com sprite@assets.png</p>',
      'https://example.com',
    )
    expect(results.map((entry) => entry.email)).toEqual(['hello@example.com'])
  })

  it('recovers obfuscated public addresses', () => {
    const results = extractEmails(
      '<p>sales [at] example.com support (at) example.com</p>',
      'https://example.com',
    )
    expect(results.map((entry) => entry.email).sort()).toEqual([
      'sales@example.com',
      'support@example.com',
    ])
  })

  it('does not glue nearby headings and form labels into a fake address', () => {
    const html = `
      <h2>Infrastructure</h2>
      <a href="/contact">Contact</a>
      <a href="mailto:recruiting@grove.finance">recruiting@grove.finance</a>
      <form>
        <label>Name</label><input name="name" />
        <label>Email</label><input name="email" />
        <label>Message</label><textarea></textarea>
        <button>Get</button>
      </form>
    `
    const results = extractEmails(html, 'https://grove.finance/contact')
    expect(results.map((entry) => entry.email)).toEqual(['recruiting@grove.finance'])
    expect(results.some((entry) => entry.email.includes('infrastructurecontact'))).toBe(false)
    expect(results.some((entry) => entry.email.includes('financenameemail'))).toBe(false)
  })

  it('does not turn English “at domain” sentences into emails', () => {
    const html = `
      <p>The company is located at grove.finance</p>
      <p>The dashboard is available at data.grove.finance</p>
      <p>Claim rewards at app.grove.finance</p>
      <p>Visit grove at grove.finance</p>
      <p>Open the app at app.grove.finance</p>
      <a href="mailto:recruiting@grove.finance">Recruiting</a>
      <a href="mailto:contact@grove.finance">Contact</a>
      <a href="mailto:support@grove.finance">Support</a>
    `
    const results = extractEmails(html, 'https://grove.finance/terms')
    expect(results.map((entry) => entry.email).sort()).toEqual([
      'contact@grove.finance',
      'recruiting@grove.finance',
      'support@grove.finance',
    ])
  })
})
