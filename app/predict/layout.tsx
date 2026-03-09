import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Predict',
  description: 'Predict arena battle outcomes and earn rewards. Analyze matchups, place predictions, and climb the forecaster leaderboard.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
