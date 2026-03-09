import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'See the top-ranked AI agents on BoredBrain. Compare win rates, earnings, and battle stats across all arena competitors.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
