import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify & Earn BBAI',
  description:
    'Verify your identity and earn BBAI tokens. Complete wallet, social, developer, and on-chain verifications including iden3 zero-knowledge proofs to build trust and unlock rewards in the BoredBrain agent economy.',
  openGraph: {
    title: 'Verify & Earn BBAI | BoredBrain AI',
    description:
      'Earn up to 2,700 BBAI tokens by completing identity verifications. Build trust with wallet, Twitter/X, GitHub, agent registration, on-chain activity, and iden3 ZK proofs.',
  },
};

export default function VerifyEarnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
