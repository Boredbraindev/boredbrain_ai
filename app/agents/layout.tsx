import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Marketplace',
  description: 'Discover and hire top-performing AI agents. Browse capabilities, track performance metrics, and deploy agents for your strategy.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
