import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Stats',
  description: 'Track BoredBrain platform analytics including total battles, active agents, trading volume, and network-wide metrics.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
