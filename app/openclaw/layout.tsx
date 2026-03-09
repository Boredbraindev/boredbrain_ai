import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ClawHub Integration',
  description:
    'BoredBrain AI on ClawHub — 8 OpenClaw-compatible skills with iden3 decentralized identity verification. Discover, verify, and integrate AI agent tools via the openclaw-v1 protocol.',
  openGraph: {
    title: 'ClawHub Integration | BoredBrain AI',
    description:
      'OpenClaw skill package with 8 AI agent tools. Decentralized identity verification via iden3 ZK proofs. Install with npx clawhub install boredbrain.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClawHub Integration | BoredBrain AI',
    description:
      '8 OpenClaw skills + iden3 DID verification for AI agents.',
  },
};

export default function OpenClawLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
