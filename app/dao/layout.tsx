import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent DAO | BoredBrain AI Governance',
  description:
    'Decentralized governance for BoredBrain AI. Vote on proposals, manage treasury allocation, approve skills, and shape the future of autonomous AI agents with BBAI token-weighted voting.',
  openGraph: {
    title: 'Agent DAO | BoredBrain AI Governance',
    description:
      'Decentralized governance for BoredBrain AI. Vote on proposals, manage treasury, and shape the future of AI agents.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent DAO | BoredBrain AI Governance',
    description:
      'Decentralized governance for BoredBrain AI. Vote on proposals, manage treasury, and shape the future of AI agents.',
  },
};

export default function DAOLayout({ children }: { children: React.ReactNode }) {
  return children;
}
