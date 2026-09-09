import { isIP } from 'node:net'

const hostnamePattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export function normalizeDomain(input: string) {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(candidate)
    const hostname = url.hostname.replace(/\.$/, '').replace(/^www\./, '')
    if (url.username || url.password || url.port || isIP(hostname) || !hostnamePattern.test(hostname)) {
      return null
    }
    return hostname
  } catch {
    return null
  }
}

export function processDomainInput(inputs: string[]) {
  const valid = new Set<string>()
  const invalid: string[] = []
  let duplicates = 0

  for (const raw of inputs.flatMap((value) => value.split(/[\s,;]+/))) {
    if (!raw.trim()) continue
    const normalized = normalizeDomain(raw)
    if (!normalized) {
      invalid.push(raw.trim())
    } else if (valid.has(normalized)) {
      duplicates += 1
    } else {
      valid.add(normalized)
    }
  }

  return { domains: [...valid], invalid, duplicates }
}
