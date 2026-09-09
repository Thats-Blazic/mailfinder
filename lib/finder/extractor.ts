import * as cheerio from 'cheerio'

const emailPattern = /[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi
const excludedExtensions = /\.(?:png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|ico)$/i
const genericLocal = /^(?:name|email|message|subject|username|user|first|last|phone|test|example|mail|your|enter)$/i
const gluedFormFields = /(?:nameemail|emailmessage|messagename|infrastructurecontact|contactusform)/i
const proseLocal = /^(?:located|available|page|claim|app|dashboard|visit|follow|find|based|found|here|this|our|their|website|site|domain|click|read|more|learn|see|view|go|get|please|from|with|you|we|they|welcome|home|blog|news|login|sign|signup|register|download|start|join|apply|using|used|use|via|into|onto|upon|within|among|including|data|http|https|www|html|json|src|href|url|link|file|image|img|icon|logo|button|form|input|label|text|content|title|header|footer|nav|menu|item|list|grid|row|column|section|block|widget|component|module|plugin|script|style|class)$/i
const mailboxLocal = 'info|hello|contact|sales|support|recruiting|admin|office|hr|jobs|press|media|partners|bizdev|partnerships'

const gTlds = new Set(
  `
    com org net edu gov mil int info biz name pro aero museum coop
    xyz online site shop app dev io ai co uk us me tv cc ws
    tech store blog cloud email finance company agency solutions
    digital studio media global world today live news network
    systems group llc ltd inc health legal jobs care team page
    space website fun life work center services consulting
    capital ventures partners fund crypto defi dao
    de fr es it nl be ch at pl se no dk fi ie pt cz hu ro
    au ca nz jp kr cn in br mx za ae sa sg hk tw
    rs hr ba me mk si sk bg gr tr ua ru
  `.trim().split(/\s+/),
)

export type ExtractedEmail = {
  email: string
  emailType: string
  sourceType: string
  confidence: number
}

function classify(email: string) {
  const local = email.split('@')[0]
  if (/^(sales|business|partnerships?|bizdev|recruiting|careers?|jobs?|hr)$/.test(local)) return 'SALES'
  if (/^(support|help|service|success)$/.test(local)) return 'SUPPORT'
  if (/^(info|hello|contact|office|admin)$/.test(local)) return 'GENERAL'
  return 'PERSONAL'
}

function confidence(email: string, pageHostname?: string) {
  const emailDomain = email.split('@')[1]
  if (pageHostname && (emailDomain === pageHostname || pageHostname.endsWith(`.${emailDomain}`))) return 95
  if (/^(info|hello|contact|sales|support|recruiting)@/.test(email)) return 85
  return 70
}

function deobfuscate(html: string) {
  return html
    .replace(/&#64;|&#x40;|&commat;/gi, '@')
    .replace(/\s*\[(?:at|@)\]\s*/gi, '@')
    .replace(/\s*\((?:at|@)\)\s*/gi, '@')
    .replace(new RegExp(`\\b(${mailboxLocal})\\s+at\\s+([a-z0-9.-]+\\.[a-z]{2,24})\\b`, 'gi'), '$1@$2')
    .replace(/\s*\[(?:dot)\]\s*/gi, '.')
    .replace(/\s*\((?:dot)\)\s*/gi, '.')
}

function hasValidTld(domain: string) {
  const labels = domain.split('.').filter(Boolean)
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1]
  if (!/^[a-z]+$/.test(tld) || tld.length < 2 || tld.length > 24) return false
  return tld.length === 2 || gTlds.has(tld)
}

function localMirrorsHost(local: string, domain: string) {
  const labels = domain.split('.')
  return labels[0] === local || labels[labels.length - 2] === local
}

function isPlausibleEmail(email: string, sourceType: string) {
  const [local, domain] = email.split('@')
  if (!local || !domain || local.length > 64 || email.length > 254) return false
  if (domain.includes('..') || excludedExtensions.test(email)) return false
  if (!hasValidTld(domain)) return false
  if (genericLocal.test(local) || gluedFormFields.test(email.replace('@', ''))) return false
  if (sourceType !== 'MAILTO') {
    if (proseLocal.test(local)) return false
    if (localMirrorsHost(local, domain)) return false
  }
  return true
}

function collect(text: string, sourceType: string, into: Map<string, string>) {
  for (const match of deobfuscate(text).match(emailPattern) || []) {
    const email = match.toLowerCase().replace(/^[.,;:]+|[.,;:]+$/g, '')
    if (!isPlausibleEmail(email, sourceType)) continue
    if (!into.has(email)) into.set(email, sourceType)
  }
}

function visibleText($: cheerio.CheerioAPI) {
  const parts: string[] = []
  $.root()
    .find('*')
    .contents()
    .each((_, node) => {
      if (node.type === 'text') {
        const value = String((node as { data?: string }).data || '').replace(/\s+/g, ' ').trim()
        if (value) parts.push(value)
      }
    })
  return parts.join(' ')
}

export function extractEmails(html: string, sourceUrl: string): ExtractedEmail[] {
  const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase()
  const $ = cheerio.load(html)
  const candidates = new Map<string, string>()

  $('a[href^="mailto:"], area[href^="mailto:"]').each((_, element) => {
    const href = $(element).attr('href') || ''
    const encoded = href.replace(/^mailto:/i, '').split('?')[0]
    let decoded = encoded
    try {
      decoded = decodeURIComponent(encoded)
    } catch {
      // Keep malformed public markup scanable instead of failing the page.
    }
    collect(decoded, 'MAILTO', candidates)
  })

  for (const attribute of ['content', 'value', 'data-email', 'placeholder', 'title', 'aria-label']) {
    $(`[${attribute}]`).each((_, element) => {
      collect($(element).attr(attribute) || '', 'HTML_SOURCE', candidates)
    })
  }

  collect(html.replace(/<[^>]+>/g, ' '), 'HTML_SOURCE', candidates)
  collect(visibleText($), 'VISIBLE_TEXT', candidates)

  return [...candidates]
    .map(([email, sourceType]) => ({
      email,
      emailType: classify(email),
      sourceType,
      confidence: confidence(email, hostname),
    }))
}
