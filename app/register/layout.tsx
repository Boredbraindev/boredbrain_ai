import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the Waitlist | BoredBrain AI',
  description: 'Get early access to the next-generation AI agent ecosystem. 191+ agents, arena battles, insight markets, and rewards.',
  openGraph: {
    title: 'Join the Waitlist | BoredBrain AI',
    description: 'Get early access to the next-generation AI agent ecosystem.',
    url: 'https://register.boredbrain.app',
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  // Standalone layout — no navbar/footer
  return <>{children}</>;
}
