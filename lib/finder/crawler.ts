import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import * as cheerio from 'cheerio'
import { Agent, fetch as undiciFetch } from 'undici'
import { extractEmails, type ExtractedEmail } from '@/lib/finder/extractor'

export type CrawlSettings = {
  maxPages: number
  timeoutMs: number
  mode: 'FAST' | 'STANDARD' | 'DEEP'
}

export type CrawlResult = ExtractedEmail & { sourceUrl: string }

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number)
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0) ||
    a >= 224
  )
}

export function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address)
  const value = address.toLowerCase()
  if (value.startsWith('::ffff:')) return isPrivateIpv4(value.slice(7))
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value) ||
    value.startsWith('2001:db8')
  )
}

export async function assertPublicUrl(url: URL, timeoutMs = 4_000) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol')
  if (url.username || url.password || url.port) throw new Error('Credentials and custom ports are not allowed')
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || isIP(url.hostname)) {
    throw new Error('Local and IP targets are not allowed')
  }

  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timed out')), timeoutMs)),
  ])
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Target resolves to a private or reserved network')
  }
  return addresses
}

async function readLimited(response: { body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> } } | null }, limit: number) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done || !value) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      throw new Error('Page exceeds the 5 MB limit')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function downloadHtml(initialUrl: URL, timeoutMs: number) {
  let url = initialUrl
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const [resolved] = await assertPublicUrl(url, timeoutMs)
    // Pin the vetted DNS answer for the connection to prevent DNS rebinding
    // between validation and the outbound request while retaining TLS SNI.
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          const record = { address: resolved.address, family: resolved.family }
          if (options?.all) callback(null, [record])
          else callback(null, resolved.address, resolved.family)
        },
      },
    })
    try {
      const response = await undiciFetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: 'text/html,application/xhtml+xml,application/json;q=0.8',
          'user-agent': 'GhostMailFinder/1.0 (+public-email-discovery)',
        },
        dispatcher,
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new Error('Redirect did not provide a location')
        await response.body?.cancel()
        url = new URL(location, url)
        continue
      }
      if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`)

      const contentLength = Number(response.headers.get('content-length') || 0)
      if (contentLength > 5_000_000) throw new Error('Page exceeds the 5 MB limit')
      const contentType = response.headers.get('content-type') || ''
      if (
        contentType &&
        !/(?:text\/html|application\/xhtml\+xml|application\/json|application\/xml|text\/xml|text\/plain)/i.test(contentType)
      ) {
        throw new Error('Page is not HTML, XML, or JSON')
      }
      return { html: await readLimited(response, 5_000_000), finalUrl: url }
    } finally {
      await dispatcher.close()
    }
  }
  throw new Error('Too many redirects')
}

const skipPath = /\.(?:pdf|zip|rar|7z|png|jpe?g|gif|svg|webp|avif|css|js|mjs|map|woff2?|ttf|eot|ico|mp4|webm|mp3|wav|mov|dmg|exe|apk)$/i

const PRIORITY_TIERS: Array<{ score: number; slugs: string[]; phrases: string[] }> = [
  {
    score: 100,
    slugs: ['contact', 'contact-us', 'contactus', 'get-in-touch', 'reach-us', 'privacy', 'terms', 'privacy-policy'],
    phrases: ['contact us', 'contact', 'get in touch', 'reach us', 'privacy policy', 'privacy', 'terms of service', 'terms'],
  },
  {
    score: 80,
    slugs: ['about', 'about-us', 'company', 'who-we-are'],
    phrases: ['about us', 'about', 'our company', 'who we are', 'company'],
  },
  {
    score: 60,
    slugs: ['team', 'our-team', 'people'],
    phrases: ['our team', 'team', 'people', 'meet the team'],
  },
  {
    score: 40,
    slugs: ['support', 'help', 'customer-service'],
    phrases: ['customer service', 'support', 'help center', 'help'],
  },
  {
    score: 20,
    slugs: ['sales', 'marketing'],
    phrases: ['sales', 'marketing'],
  },
  {
    score: 10,
    slugs: ['imprint', 'impressum', 'legal', 'careers', 'staff', 'leadership', 'partners', 'press', 'faq', 'connect'],
    phrases: ['imprint', 'legal', 'careers', 'leadership', 'partners', 'press', 'faq'],
  },
]

const HOMEPAGE_SCORE = 90

function normalizePath(pathname: string) {
  return pathname
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/\.(?:html?|php|aspx?)$/i, '')
    .replace(/_/g, '-') || '/'
}

function slugMatches(pathname: string, slug: string) {
  const path = normalizePath(pathname)
  const compactSlug = slug.replaceAll('-', '')
  if (path === `/${slug}` || path.endsWith(`/${slug}`)) return true
  return path.split('/').filter(Boolean).some((segment) => {
    const compactSegment = segment.replaceAll('-', '')
    return segment === slug || compactSegment === compactSlug
  })
}

function phraseMatches(text: string, phrase: string) {
  const value = text.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!value) return false
  if (value === phrase || value.includes(phrase)) return true
  return value.replaceAll(/[\s_-]+/g, '') === phrase.replaceAll(/[\s_-]+/g, '')
}

export function pagePriority(url: string, anchorText = '') {
  try {
    const parsed = new URL(url)
    const path = normalizePath(parsed.pathname)
    if (path === '/') return HOMEPAGE_SCORE
    let best = 1
    for (const tier of PRIORITY_TIERS) {
      if (tier.slugs.some((slug) => slugMatches(path, slug))) best = Math.max(best, tier.score)
      if (tier.phrases.some((phrase) => phraseMatches(anchorText, phrase))) best = Math.max(best, tier.score)
    }
    return best
  } catch {
    return 1
  }
}

type QueuedPage = { url: string; score: number }

function pageKey(url: string) {
  return url.replace(/\/$/, '')
}

function enqueuePage(queue: QueuedPage[], url: string, score: number, visited: Set<string>) {
  const key = pageKey(url)
  if (visited.has(key)) return
  const existing = queue.find((item) => pageKey(item.url) === key)
  if (existing) {
    existing.score = Math.max(existing.score, score)
    return
  }
  queue.push({ url, score })
}

function dequeuePage(queue: QueuedPage[]) {
  let best = 0
  for (let index = 1; index < queue.length; index += 1) {
    if (queue[index].score > queue[best].score) best = index
  }
  return queue.splice(best, 1)[0]
}

function sameSiteLink(href: string, pageUrl: URL, rootHostname: string) {
  if (!href || href.startsWith('#') || /^(?:mailto|tel|javascript|data):/i.test(href)) return null
  try {
    const candidate = new URL(href, pageUrl)
    const hostname = candidate.hostname.replace(/^www\./, '')
    if (hostname !== rootHostname || !['http:', 'https:'].includes(candidate.protocol)) return null
    if (skipPath.test(candidate.pathname)) return null
    candidate.hash = ''
    return candidate.toString()
  } catch {
    return null
  }
}

function discoverLinks(html: string, pageUrl: URL, rootHostname: string, mode: CrawlSettings['mode']) {
  if (mode === 'FAST') return [] as QueuedPage[]
  const $ = cheerio.load(html)
  const links = new Map<string, number>()

  $('a[href], area[href], link[rel="canonical"]').each((_, element) => {
    const href = $(element).attr('href')
    const next = sameSiteLink(href || '', pageUrl, rootHostname)
    if (!next) return
    const score = pagePriority(next, $(element).text())
    if (mode !== 'DEEP' && score < 10) return
    links.set(next, Math.max(links.get(next) || 0, score))
  })
  return [...links.entries()].map(([url, score]) => ({ url, score }))
}

async function discoverSitemap(rootHostname: string, timeoutMs: number) {
  const found = new Set<string>()
  for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']) {
    try {
      const { html } = await downloadHtml(new URL(`https://${rootHostname}${path}`), timeoutMs)
      for (const match of html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
        const next = sameSiteLink(match[1].trim(), new URL(`https://${rootHostname}/`), rootHostname)
        if (next && !skipPath.test(next)) found.add(next)
      }
    } catch {
      // Sitemap is optional public metadata.
    }
  }
  return [...found]
}

const seedPaths = [
  '/contact',
  '/contact-us',
  '/contactus',
  '/get-in-touch',
  '/reach-us',
  '/privacy',
  '/terms',
  '/privacy-policy',
  '/about',
  '/about-us',
  '/company',
  '/who-we-are',
  '/team',
  '/our-team',
  '/people',
  '/support',
  '/help',
  '/customer-service',
  '/sales',
  '/marketing',
]

export async function crawlDomain(hostname: string, settings: CrawlSettings) {
  const rootHostname = hostname.replace(/^www\./, '').toLowerCase()
  const visited = new Set<string>()
  const queue: QueuedPage[] = []
  enqueuePage(queue, `https://${rootHostname}/`, HOMEPAGE_SCORE, visited)
  for (const path of seedPaths) {
    const url = `https://${rootHostname}${path}`
    enqueuePage(queue, url, pagePriority(url), visited)
  }
  if (settings.mode !== 'FAST') {
    for (const page of await discoverSitemap(rootHostname, settings.timeoutMs)) {
      enqueuePage(queue, page, pagePriority(page), visited)
    }
  }
  const collected: CrawlResult[] = []
  let lastHomepageError: unknown
  let pagesScanned = 0

  while (queue.length && pagesScanned < settings.maxPages) {
    const current = dequeuePage(queue)
    const key = pageKey(current.url)
    if (visited.has(key)) continue
    visited.add(key)
    try {
      const { html, finalUrl } = await downloadHtml(new URL(current.url), settings.timeoutMs)
      pagesScanned += 1
      for (const result of extractEmails(html, finalUrl.toString())) {
        collected.push({ ...result, sourceUrl: finalUrl.toString() })
      }
      for (const link of discoverLinks(html, finalUrl, rootHostname, settings.mode)) {
        enqueuePage(queue, link.url, link.score, visited)
      }
      if (current.url.startsWith('https://')) {
        const fallback = pageKey(`http://${rootHostname}/`)
        const index = queue.findIndex((item) => pageKey(item.url) === fallback)
        if (index >= 0) queue.splice(index, 1)
      }
    } catch (error) {
      if (pagesScanned === 0) lastHomepageError = error
    }
  }

  if (pagesScanned === 0 && lastHomepageError) throw lastHomepageError
  return {
    pagesScanned,
    results: collected.filter(
      (entry, index, entries) => entries.findIndex((other) => other.email === entry.email) === index,
    ),
  }
}
