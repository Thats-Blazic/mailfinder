import { PrismaClient } from '@prisma/client'
import { seedApp } from './seed-app'
import { SQLITE_INIT_STATEMENTS } from './sqlite-init'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL || 'file:./prisma/dev.db'
  if (process.env.VERCEL && fromEnv.startsWith('file:')) {
    return 'file:/tmp/mailfinder.db'
  }
  return fromEnv
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
    if (!process.env.VERCEL) throw error
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
