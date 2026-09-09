import { PrismaClient } from '@prisma/client'
import { seedApp } from './seed-app'
import { SQLITE_INIT_STATEMENTS } from './sqlite-init'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function isPostgresUrl(url: string) {
  return /^(postgres|postgresql|prisma\+postgres|prisma):\/\//i.test(url.trim())
}

function withPostgresParams(url: string) {
  if (!isPostgresUrl(url)) return url
  const join = url.includes('?') ? '&' : '?'
  if (!/[?&]sslmode=/i.test(url)) url += `${join}sslmode=require`
  return url
}

function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL || 'file:./prisma/dev.db'
  if (process.env.VERCEL && fromEnv.startsWith('file:')) {
    return 'file:/tmp/mailfinder.db'
  }
  return withPostgresParams(fromEnv)
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

let ready = false
let pending: Promise<void> | null = null

async function applySqliteSchema() {
  for (const statement of SQLITE_INIT_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement)
  }
}

async function bootstrap() {
  try {
    const existing = await prisma.user.findFirst({ select: { id: true } })
    if (!existing) await seedApp(prisma)
  } catch (error) {
    console.error('Database bootstrap failed', error)
    if (!process.env.VERCEL || isPostgresUrl(databaseUrl())) throw error
    await applySqliteSchema()
    await seedApp(prisma)
  }
}

export async function ensureDatabase() {
  if (ready) return
  if (!pending) {
    pending = bootstrap()
      .then(() => {
        ready = true
      })
      .catch((error) => {
        pending = null
        throw error
      })
  }
  await pending
}
