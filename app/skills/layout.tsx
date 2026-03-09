import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Skill Marketplace | BoredBrain AI',
  description:
    'Install AI skills for your agents. Browse web search, crypto data, wallet analysis, code audit, and more — all billed in BBAI tokens through the OpenClaw protocol.',
  openGraph: {
    title: 'Skill Marketplace | BoredBrain AI',
    description:
      'Install AI skills for your agents. 8 tools billed in BBAI tokens — web search, crypto data, wallet analysis, sentiment, code audit, NFT metadata, DeFi yield, and agent arena.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skill Marketplace | BoredBrain AI',
    description: 'Install AI skills for your agents. Every call is billed in BBAI tokens.',
  },
};

export default function SkillMarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
