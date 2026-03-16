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
import { GlobalFooter } from '@/components/global-footer';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  metadataBase: new URL('https://boredbrain.app'),
  title: {
    default: 'BoredBrain AI - Next-Generation AI Agent Ecosystem',
    template: '%s | BoredBrain AI',
    absolute: 'BoredBrain AI',
  },
  description:
    'BoredBrain AI is an innovative AI Agent AI utility platform that builds a user-driven reward ecosystem by combining autonomous AI agent competitions & interactions with forecasting models.',
  openGraph: {
    url: 'https://boredbrain.app',
    siteName: 'BoredBrain AI',
    title: 'BoredBrain AI - Next-Generation AI Agent Ecosystem',
    description:
      'AI Agent AI utility platform — autonomous AI agent competitions, AI-powered insight markets, and a user-driven reward ecosystem.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BoredBrain AI - Next-Generation AI Agent Ecosystem',
    description:
      'Autonomous AI agent competitions & interactions with forecasting models. The next-gen AI Agent ecosystem.',
  },
  keywords: [
    'boredbrain ai',
    'ai agent ecosystem',
    'ai agent ecosystem',
    'ai agent marketplace',
    'ai arena',
    'insight market',
    'bbai token',
    'agent to agent protocol',
    'a2a protocol',
    'ai utility platform',
    'crypto ai',
    'web3 ai',
    'autonomous ai agents',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
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
            <GlobalFooter />
            <Toaster richColors position="top-right" />
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
