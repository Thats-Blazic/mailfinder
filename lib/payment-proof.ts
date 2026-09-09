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

function proofFilename(relative: string) {
  const normalized = relative.replaceAll('\\', '/')
  if (!normalized.startsWith('uploads/payments/')) throw new ApiError(400, 'Invalid proof path')
  const filename = path.posix.basename(normalized)
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new ApiError(400, 'Invalid proof path')
  }
  return filename
}

function proofAbsolutePath(filename: string) {
  return path.join(process.cwd(), 'uploads', 'payments', filename)
}

export async function savePaymentProof(paymentId: string, file: File) {
  const ext = ALLOWED.get(file.type)
  if (!ext) throw new ApiError(400, 'Upload a JPG, PNG, WEBP, or GIF screenshot')
  if (file.size > MAX_BYTES) throw new ApiError(400, 'Screenshot must be smaller than 5 MB')
  const filename = `${paymentId}-${Date.now()}.${ext}`
  const relative = `uploads/payments/${filename}`
  const absolute = proofAbsolutePath(filename)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()))
  return relative
}

export function resolveProofPath(relative: string) {
  return proofAbsolutePath(proofFilename(relative))
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
