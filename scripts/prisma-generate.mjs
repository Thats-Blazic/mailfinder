import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = process.cwd()
const url = (process.env.DATABASE_URL || '').trim().replace(/^['"]|['"]$/g, '')
const postgres = /^(postgres|postgresql|prisma\+postgres|prisma):\/\//i.test(url)

if (!url) {
  process.env.DATABASE_URL = 'file:./prisma/dev.db'
}

const schemaFile = path.join(root, 'prisma/schema.prisma')
const sourceSchema = readFileSync(schemaFile, 'utf8')
const provider = postgres ? 'postgresql' : 'sqlite'
const patched = sourceSchema.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")(?:sqlite|postgresql)(")/,
  `$1${provider}$2`,
)

if (patched !== sourceSchema) {
  writeFileSync(schemaFile, patched)
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

run(['generate', `--schema=${schemaFile}`])

if (process.env.VERCEL && postgres) {
  run(['db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${schemaFile}`])
}
