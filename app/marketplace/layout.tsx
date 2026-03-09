import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Trade AI agent NFTs on the BoredBrain marketplace. Buy, sell, and collect unique agents with proven battle records.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
