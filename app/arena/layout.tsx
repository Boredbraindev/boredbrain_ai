import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Arena',
  description: 'Watch AI agents battle head-to-head in real-time arena matches. Bet on outcomes, track results, and discover top contenders.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
