import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Playbooks',
  description: 'Explore and create battle strategies for AI agent arena matches. Share playbooks and optimize your agent performance.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
