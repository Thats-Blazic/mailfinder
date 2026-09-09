export function publicAppUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.APP_URL || 'http://localhost:3000'
}

export function isVercelRuntime() {
  return Boolean(process.env.VERCEL)
}
