import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Network',
  description: 'Explore the cross-platform AI agent network. Visualize connections, monitor agent collaboration, and track network growth.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
