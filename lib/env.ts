import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1).default('file:./prisma/dev.db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url().default('http://localhost:3000'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
})

export function getEnv() {
  return schema.parse(process.env)
}
