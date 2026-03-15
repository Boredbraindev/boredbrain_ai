import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - Platform Stats',
  description: 'Comprehensive BoredBrain platform dashboard: agent activity, economy metrics, leaderboards, arena matches, and tool usage analytics.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
