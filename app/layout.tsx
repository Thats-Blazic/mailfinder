import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: {
    default: 'Ghost Mail Finder',
    template: '%s · Ghost Mail Finder',
  },
  description: 'Discover publicly available business contact emails with transparent sources.',
  applicationName: 'Ghost Mail Finder',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0f17',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark bg-background"><body className={`${geist.variable} ${geistMono.variable} min-h-screen antialiased`}>{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
