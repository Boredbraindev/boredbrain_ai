import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forecast',
  description: 'Forecast market outcomes and earn rewards. Analyze matchups, take positions, and climb the forecaster leaderboard.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
