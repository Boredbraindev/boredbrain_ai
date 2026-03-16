import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rewards',
  description: 'Earn BBAI tokens by participating in arena battles, AI insights, and marketplace activity. Track and claim your rewards.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
