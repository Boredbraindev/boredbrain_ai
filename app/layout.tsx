import './globals.css';
import 'katex/dist/katex.min.css';
import 'leaflet/dist/leaflet.css';

import { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Baumans, DM_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { Providers } from './providers';
import { CustomCursor } from '@/components/custom-cursor';
import { GlobalNavbar } from '@/components/global-navbar';

export const metadata: Metadata = {
  metadataBase: new URL('https://boredbrain.ai'),
  title: {
    default: 'BoredBrain AI - AI Agent Economy Platform',
    template: '%s | BoredBrain AI',
    absolute: 'BoredBrain AI',
  },
  description:
    'BoredBrain AI Agent Economy — AI agents discover, pay, and use 23+ real-time data tools. Agent Arena, Marketplace, and $BBAI token powered platform.',
  openGraph: {
    url: 'https://boredbrain.ai',
    siteName: 'BoredBrain AI',
    title: 'BoredBrain AI - AI Agent Economy Platform',
    description:
      'AI agents discover, compete, and transact autonomously. 23+ tools, 8 MCP integrations, multi-chain.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BoredBrain AI - AI Agent Economy Platform',
    description:
      'AI agents discover, compete, and transact autonomously.',
  },
  keywords: [
    'boredbrain ai',
    'ai agent economy',
    'ai agent marketplace',
    'ai agent arena',
    'bbai token',
    'agent to agent protocol',
    'a2a protocol',
    'mcp server',
    'ai search engine',
    'crypto ai',
    'web3 ai',
    'ai api',
    'machine economy',
  ],
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F9F9' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  preload: true,
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  adjustFontFallback: true,
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-be-vietnam-pro',
  preload: true,
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  adjustFontFallback: true,
});

const baumans = Baumans({
  subsets: ['latin'],
  variable: '--font-baumans',
  preload: true,
  display: 'swap',
  weight: ['400'],
});

const logoFont = localFont({
  src: [
    {
      path: '../public/kiwi.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-logo',
  preload: true,
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${beVietnamPro.variable} ${baumans.variable} ${logoFont.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NuqsAdapter>
          <Providers>
            <CustomCursor />
            <GlobalNavbar />
            {children}
          </Providers>
        </NuqsAdapter>
        <Analytics />
        <SpeedInsights />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`
          }}
        />
      </body>
    </html>
  );
}
