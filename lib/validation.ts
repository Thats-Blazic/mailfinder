import { ScanMode } from '@prisma/client'
import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase character')
  .regex(/\d/, 'Password must contain a number')

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const planSchema = z.object({
  name: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  description: z.string().trim().min(2).max(500),
  price: z.coerce.number().positive('Free plans are not allowed').max(10_000_000),
  currency: z.string().trim().min(3).max(8).transform((value) => value.toUpperCase()),
  cryptoPrice: z.record(z.string(), z.number().positive()).optional(),
  credits: z.coerce.number().int().positive().max(100_000_000).optional().default(1),
  durationDays: z.coerce.number().int().positive().max(3650),
  active: z.boolean().default(true),
})

export const creditChangeSchema = z.object({
  operation: z.enum(['ADD', 'REMOVE', 'RESET']),
  amount: z.coerce.number().int().nonnegative().max(100_000_000),
  reason: z.string().trim().min(3).max(500),
})

export const assignPlanSchema = z.object({
  planId: z.string().min(1),
  durationDays: z.coerce.number().int().positive().max(3650).optional(),
  reason: z.string().trim().min(3).max(500).default('Manual plan assignment'),
})

export const paymentRequestSchema = z.object({
  planId: z.string().min(1),
  cryptocurrency: z.string().trim().min(2).max(12).transform((value) => value.toUpperCase()),
})

export const paymentSubmissionSchema = z.object({
  transactionHash: z.string().trim().max(256).optional(),
  telegramHandle: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value ? value.replace(/^@/, '') : value)),
})

export const paymentReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
  adminNote: z.string().trim().max(1000).optional(),
})

export const createSearchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mode: z.nativeEnum(ScanMode).default(ScanMode.DEEP),
  domains: z.array(z.string().trim()).min(1).max(1000),
})
