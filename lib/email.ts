import 'server-only'

import nodemailer from 'nodemailer'

export async function sendPasswordReset(email: string, token: string) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
  const host = process.env.SMTP_HOST

  if (!host) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured')
    }
    console.info(`[Ghost Mail Finder] Development password reset for ${email}: ${resetUrl}`)
    return
  }

  const port = Number(process.env.SMTP_PORT || 587)
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Ghost Mail Finder <noreply@example.com>',
    to: email,
    subject: 'Reset your Ghost Mail Finder password',
    text: `Reset your password within one hour: ${resetUrl}\n\nIf you did not request this, ignore this message.`,
    html: `<p>Reset your Ghost Mail Finder password within one hour:</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, ignore this message.</p>`,
  })
}
