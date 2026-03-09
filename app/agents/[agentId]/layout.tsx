import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Details',
  description: 'View detailed AI agent performance stats, battle history, capabilities, and hiring options on BoredBrain AI.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
