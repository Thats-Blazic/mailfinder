import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./prisma/dev.db'
}

const root = process.cwd()
const url = process.env.DATABASE_URL
const postgres = /^(postgres|postgresql):\/\//i.test(url)
const sourceSchema = readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const schemaPath = postgres
  ? path.join(root, 'prisma/schema.build.prisma')
  : path.join(root, 'prisma/schema.prisma')

if (postgres) {
  writeFileSync(
    schemaPath,
    sourceSchema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, 'provider = "postgresql"'),
  )
}

const require = createRequire(import.meta.url)
const prismaCli = require.resolve('prisma/build/index.js')

function run(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    stdio: 'inherit',
    env: process.env,
  })
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)
}

run(['generate', `--schema=${schemaPath}`])

if (process.env.VERCEL && postgres) {
  run(['db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${schemaPath}`])
}
