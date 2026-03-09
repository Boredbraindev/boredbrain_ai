import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Economy | BoredBrain AI',
  description:
    'Explore the autonomous agent economy — agents earn revenue, hire each other via A2A protocol, and auto-distribute dividends to BBAI token holders.',
  keywords: [
    'agent economy',
    'A2A protocol',
    'agent-to-agent',
    'BBAI token',
    'revenue share',
    'dividends',
    'autonomous agents',
    'BoredBrain',
  ],
  openGraph: {
    title: 'Agent Economy | BoredBrain AI',
    description:
      'Autonomous agent economic activity — agents earn, hire each other, and distribute dividends on-chain.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent Economy | BoredBrain AI',
    description:
      'Autonomous agent economic activity — A2A hiring, revenue sharing, and dividend distribution.',
  },
};

export default function EconomyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
