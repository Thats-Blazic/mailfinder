import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ApiError } from '@/lib/api'

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])
const MAX_BYTES = 5_000_000
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'payments')

export async function savePaymentProof(paymentId: string, file: File) {
  const ext = ALLOWED.get(file.type)
  if (!ext) throw new ApiError(400, 'Upload a JPG, PNG, WEBP, or GIF screenshot')
  if (file.size > MAX_BYTES) throw new ApiError(400, 'Screenshot must be smaller than 5 MB')
  const relative = path.posix.join('uploads/payments', `${paymentId}-${Date.now()}.${ext}`)
  const absolute = resolveProofPath(relative)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()))
  return relative
}

export function resolveProofPath(relative: string) {
  if (!relative.replaceAll('\\', '/').startsWith('uploads/payments/')) {
    throw new ApiError(400, 'Invalid proof path')
  }
  const absolute = path.resolve(process.cwd(), relative)
  const relativeToRoot = path.relative(UPLOAD_ROOT, absolute)
  if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new ApiError(400, 'Invalid proof path')
  }
  return absolute
}

export async function readPaymentProof(relative: string) {
  return readFile(resolveProofPath(relative))
}

export function proofContentType(relative: string) {
  if (relative.endsWith('.png')) return 'image/png'
  if (relative.endsWith('.webp')) return 'image/webp'
  if (relative.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}
