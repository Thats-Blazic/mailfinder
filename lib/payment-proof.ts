import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ApiError } from '@/lib/api'
import { prisma } from '@/lib/db'

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
  const bytes = Buffer.from(await file.arrayBuffer())
  const relative = `db:${paymentId}`
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      proofImage: relative,
      proofBytes: bytes,
      proofMime: file.type,
    },
  })
  if (!process.env.VERCEL) {
    const filename = `${paymentId}-${Date.now()}.${ext}`
    const absolute = proofAbsolutePath(filename)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, bytes)
  }
  return relative
}

export function resolveProofPath(relative: string) {
  return proofAbsolutePath(proofFilename(relative))
}

export async function readPaymentProof(relative: string) {
  if (relative.startsWith('db:')) {
    const payment = await prisma.payment.findUnique({
      where: { id: relative.slice(3) },
      select: { proofBytes: true },
    })
    if (!payment?.proofBytes) throw new ApiError(404, 'Payment screenshot not found')
    return Buffer.from(payment.proofBytes)
  }
  return readFile(resolveProofPath(relative))
}

export function proofContentType(relative: string, mime?: string | null) {
  if (mime) return mime
  if (relative.endsWith('.png')) return 'image/png'
  if (relative.endsWith('.webp')) return 'image/webp'
  if (relative.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}
