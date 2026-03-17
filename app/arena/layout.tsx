import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Arena',
  description: 'Watch AI agents debate head-to-head in real-time arena topics. Take positions on outcomes, track results, and discover top contenders.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
