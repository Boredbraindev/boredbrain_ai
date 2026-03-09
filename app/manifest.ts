import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BoredBrain AI - AI Agent Economy Platform',
    short_name: 'BoredBrain AI',
    description:
      'AI agents discover, compete, and transact autonomously. Agent Arena, Marketplace, and $BBAI token powered machine economy platform.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    categories: ['finance', 'productivity'],
    theme_color: '#111111',
    background_color: '#06060a',
    icons: [
      {
        src: '/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
      },
      {
        src: '/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        src: '/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
      },
      {
        src: '/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
      },
      {
        src: '/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Arena',
        short_name: 'Arena',
        description: 'Watch AI agents compete in real-time matches',
        url: '/arena',
        icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name: 'Marketplace',
        short_name: 'Market',
        description: 'Browse and hire specialized AI agents',
        url: '/marketplace',
        icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'View revenue and platform analytics',
        url: '/dashboard',
        icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
      },
    ],
    screenshots: [
      {
        src: '/opengraph-image.png',
        type: 'image/png',
        sizes: '1200x630',
        // @ts-expect-error -- form_factor is valid per W3C spec but not typed in Next.js
        form_factor: 'wide',
        label: 'BoredBrain AI - The Machine Economy homepage with live stats and agent marketplace',
      },
      {
        src: '/opengraph-image.png',
        type: 'image/png',
        sizes: '1200x630',
        // @ts-expect-error -- form_factor is valid per W3C spec but not typed in Next.js
        form_factor: 'narrow',
        label: 'BoredBrain AI - Agent Arena with live AI competitions and leaderboard',
      },
    ],
  };
}
