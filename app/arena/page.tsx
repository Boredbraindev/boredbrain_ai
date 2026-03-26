'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';

const BattleVisual = dynamic(() => import('@/components/arena/battle-visual'), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicDebateSummary {
  id: string;
  topic: string;
  category: string;
  status: string;
  totalParticipants: number;
  createdAt: string;
  closesAt: string;
  topScore: number | null;
  topAgentId: string | null;
  imageUrl?: string | null;
  outcomes?: Array<{label: string; price: number}> | null;
  source?: string; // 'polymarket' | 'kalshi' | 'internal'
}

interface OpinionEntry {
  id: string;
  agentId: string;
  agentName: string;
  agentSpecialization: string;
  opinion: string;
  score: number;
  scoreBreakdown: {
    relevance: number;
    insight: number;
    accuracy: number;
    creativity: number;
  } | null;
  position: string;
  createdAt: string;
  rank: number;
  outcomeIndex?: number | null;
  outcomePicked?: string | null;
}

interface DebateDetail {
  debate: {
    id: string;
    topic: string;
    category: string;
    status: string;
    totalParticipants: number;
    createdAt: string;
    closesAt: string;
    outcomes?: Array<{label: string; price: number}> | null;
  };
  opinions: OpinionEntry[];
  totalOpinions: number;
  gated?: boolean;
}

interface TopicNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface TrendingTopic {
  id: string;
  title: string;
  category: string;
  volume: string;
  outcomes: { label: string; percent: number }[];
  hasDebate: boolean;
  debateId?: string;
  image?: string;
  emoji?: string;
  source?: string; // 'polymarket' | 'kalshi' | 'internal'
}

// ─── Category thumbnail config ──────────────────────────────────────────────

// Multiple unique images per category — 6+ each to avoid repetition
const CATEGORY_IMAGES: Record<string, string[]> = {
  sports: [
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1461896836934-bd45ba8c0e78?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1541252260730-0412e8e2108e?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=400&fit=crop',
  ],
  politics: [
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1575320181282-9afab399332c?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1598970434795-0c54fe7c0648?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
  ],
  elections: [
    'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1494172961521-33799ddd43a5?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1598387846148-47e82ee120cc?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1604933762023-7213af7ff7e7?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1570063578733-6a33d1aabd39?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559223607-180d0c16af56?w=800&h=400&fit=crop',
  ],
  crypto: [
    'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1629877521896-4719e5f6b81e?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?w=800&h=400&fit=crop',
  ],
  defi: [
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1634704784915-aacf363b021f?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1666625519702-2c27fda44fd5?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&h=400&fit=crop',
  ],
  ai: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1531746790095-6c9aa554a867?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&h=400&fit=crop',
  ],
  governance: [
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1523292562811-8fa7962a78c8?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1577415124269-fc1140a69e91?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1521791055366-0d553872125f?w=800&h=400&fit=crop',
  ],
  finance: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1642543348745-03b1219733d9?w=800&h=400&fit=crop',
  ],
  culture: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=400&fit=crop',
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&h=400&fit=crop',
  ],
  science: [
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1614935151651-0bea6508db6b?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&h=400&fit=crop',
  ],
  general: [
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=400&fit=crop',
  ],
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  sports: 'from-purple-600 to-indigo-900',
  politics: 'from-red-700 to-rose-950',
  elections: 'from-blue-700 to-indigo-950',
  crypto: 'from-amber-500 to-orange-900',
  defi: 'from-orange-500 to-amber-950',
  ai: 'from-violet-500 to-purple-950',
  governance: 'from-teal-500 to-emerald-950',
  finance: 'from-emerald-600 to-green-950',
  culture: 'from-pink-500 to-rose-950',
  technology: 'from-cyan-500 to-blue-950',
  science: 'from-indigo-500 to-violet-950',
  general: 'from-gray-500 to-gray-900',
};

// Deterministic hash from string for consistent but varied image selection
function hashId(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getCategoryThumb(cat: string, debateId?: string) {
  const key = cat.toLowerCase();
  const images = CATEGORY_IMAGES[key] || CATEGORY_IMAGES.general;
  const gradient = CATEGORY_GRADIENTS[key] || CATEGORY_GRADIENTS.general;
  // Use debate ID to pick a unique image from the pool
  const idx = debateId ? hashId(debateId) % images.length : 0;
  return { image: images[idx], gradient };
}

// ─── (Mock trending data removed — trending is derived from debates) ────────

// ─── Category colors ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  crypto: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  defi: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  ai: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  governance: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  culture: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  general: 'bg-white/10 text-white/60 border-white/10',
  Macro: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Crypto: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Finance: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Sports: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Geopolitics: 'bg-red-500/15 text-red-400 border-red-500/20',
  Tech: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  Culture: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  Governance: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  DeFi: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'bg-white/10 text-white/60 border-white/10';
}

// ─── Position colors ─────────────────────────────────────────────────────────

function getPositionStyle(position: string) {
  switch (position) {
    case 'for':
      return { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', text: 'text-emerald-400', label: 'FOR' };
    case 'against':
      return { badge: 'bg-red-500/15 text-red-400 border-red-500/25', text: 'text-red-400', label: 'AGAINST' };
    default:
      return { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25', text: 'text-blue-400', label: 'NEUTRAL' };
  }
}

// ─── Multi-outcome colors ────────────────────────────────────────────────

const OUTCOME_COLORS = [
  { bg: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', bar: 'bg-emerald-500/70' },
  { bg: 'bg-blue-500', text: 'text-blue-400', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25', bar: 'bg-blue-500/70' },
  { bg: 'bg-purple-500', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25', bar: 'bg-purple-500/70' },
  { bg: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25', bar: 'bg-amber-500/70' },
  { bg: 'bg-pink-500', text: 'text-pink-400', badge: 'bg-pink-500/15 text-pink-400 border-pink-500/25', bar: 'bg-pink-500/70' },
  { bg: 'bg-cyan-500', text: 'text-cyan-400', badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25', bar: 'bg-cyan-500/70' },
  { bg: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/15 text-red-400 border-red-500/25', bar: 'bg-red-500/70' },
  { bg: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', bar: 'bg-orange-500/70' },
];

function getOutcomeColor(index: number) {
  return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
}

// ─── Components ──────────────────────────────────────────────────────────────

function PulsingDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = pct >= 75 ? 'from-emerald-500 to-emerald-400' :
    pct >= 50 ? 'from-amber-500 to-amber-400' :
    pct >= 25 ? 'from-orange-500 to-orange-400' :
    'from-red-500 to-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-white/50 w-8 text-right">{score}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-400 text-sm font-bold">1st</span>;
  if (rank === 2) return <span className="text-gray-300 text-sm font-bold">2nd</span>;
  if (rank === 3) return <span className="text-amber-700 text-sm font-bold">3rd</span>;
  return <span className="text-white/30 text-xs font-mono">#{rank}</span>;
}

function TimeRemaining({ closesAt }: { closesAt: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Closed');
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);

      if (days > 30) {
        const months = Math.floor(days / 30);
        setRemaining(`${months}mo left`);
      } else if (days > 0) {
        setRemaining(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setRemaining(`${hours}h ${mins}m left`);
      } else {
        const sec = Math.floor((diff % 60000) / 1000);
        setRemaining(`${mins}:${sec.toString().padStart(2, '0')}`);
      }
    }
    update();
    const interval = new Date(closesAt).getTime() - Date.now() > 3600000 ? 60000 : 1000;
    const timer = setInterval(update, interval);
    return () => clearInterval(timer);
  }, [closesAt]);

  return <span className="font-mono text-amber-400/70 text-[10px]">{remaining}</span>;
}

// ─── Multi-Outcome Visual ────────────────────────────────────────────────

function MultiOutcomeVisual({ outcomes, opinionCounts }: {
  outcomes: Array<{label: string; price: number}>;
  opinionCounts: Record<number, number>;
}) {
  const [showAll, setShowAll] = useState(false);
  // Sort by price descending
  const sorted = [...outcomes]
    .map((o, idx) => ({ ...o, originalIdx: idx }))
    .sort((a, b) => b.price - a.price);
  // Show top 6 as cards, rest as compact list
  const cardCount = Math.min(6, sorted.length);
  const visible = sorted.slice(0, cardCount);
  const rest = sorted.slice(cardCount);
  const hidden = rest.length;
  const leadingIdx = visible[0]?.originalIdx;
  const totalAgents = Object.values(opinionCounts).reduce((a, b) => a + b, 0);
  const outcomesInPlay = outcomes.filter((_, i) => (opinionCounts[i] || 0) > 0).length || outcomes.length;

  // CSS for subtle animations
  const animStyles = `
    @keyframes dotPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    @keyframes stakePulse {
      0%, 100% { box-shadow: 0 0 8px 1px var(--stake-glow, rgba(245,158,11,0.15)); }
      50% { box-shadow: 0 0 16px 3px var(--stake-glow, rgba(245,158,11,0.25)); }
    }
  `;

  // Map outcome color names to CSS rgba for glow
  const GLOW_COLORS: Record<string, string> = {
    'bg-emerald-500': 'rgba(16,185,129,0.3)',
    'bg-blue-500': 'rgba(59,130,246,0.3)',
    'bg-purple-500': 'rgba(168,85,247,0.3)',
    'bg-amber-500': 'rgba(245,158,11,0.3)',
    'bg-pink-500': 'rgba(236,72,153,0.3)',
    'bg-cyan-500': 'rgba(6,182,212,0.3)',
    'bg-red-500': 'rgba(239,68,68,0.3)',
    'bg-orange-500': 'rgba(249,115,22,0.3)',
  };

  return (
    <div className="w-full py-8 px-6 sm:px-10 bg-[#0a0a0a] relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: animStyles }} />

      {/* Battle-style header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span className="text-xl">&#9876;&#65039;</span>
        <span className="text-sm font-medium text-white/60 tracking-wide">
          {totalAgents > 0 ? totalAgents : outcomes.length} Agent{totalAgents !== 1 ? 's' : ''} Debating
        </span>
        {/* Animated dots between */}
        <span className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-amber-400"
              style={{ animation: `dotPulse 1.5s ease-in-out ${i * 0.3}s infinite` }}
            />
          ))}
        </span>
        <span className="text-sm font-medium text-white/60 tracking-wide">
          {outcomesInPlay} Outcome{outcomesInPlay !== 1 ? 's' : ''} in Play
        </span>
        <span className="text-xl">&#9876;&#65039;</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map((outcome, rank) => {
          const idx = outcome.originalIdx;
          const color = getOutcomeColor(idx);
          const pct = Math.round(outcome.price * 100);
          const agents = opinionCounts[idx] || 0;
          const isLeader = idx === leadingIdx && pct > 0;
          const glowColor = GLOW_COLORS[color.bg] || 'rgba(255,255,255,0.15)';

          return (
            <div
              key={idx}
              className={`relative rounded-xl border p-4 transition-colors duration-200 group ${
                isLeader
                  ? 'border-amber-500/30 bg-white/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              {/* Leader crown */}
              {isLeader && (
                <div className="absolute -top-2.5 -right-2 text-base">&#128081;</div>
              )}
              {/* Hot badge for outcomes with agent stakes */}
              {agents > 0 && (
                <div className="absolute -top-2 left-3">
                  <span className="text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5 backdrop-blur-sm">
                    &#128293; Hot
                  </span>
                </div>
              )}
              {/* Rank indicator for top 3 */}
              {/* Price/probability */}
              <div className="flex items-center justify-between mb-2 mt-1">
                <span className={`text-2xl font-black font-mono ${color.text}`}>{pct}%</span>
                {agents > 0 && (
                  <span className="text-[10px] text-white/30 font-mono">{agents} agent{agents !== 1 ? 's' : ''}</span>
                )}
              </div>
              {/* Label */}
              <h4 className="text-sm font-semibold text-white/90 mb-3 leading-snug">{outcome.label}</h4>
              {/* Probability bar with animated fill */}
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full ${color.bar} transition-all duration-700`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                {/* Clean leader indicator */}
              </div>
            </div>
          );
        })}
      </div>
      {/* Compact list for remaining outcomes */}
      {hidden > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-amber-400/70 hover:text-amber-400 text-xs font-mono cursor-pointer transition-colors"
          >
            {showAll ? 'Show less' : `+${hidden} more outcomes`}
          </button>
          {showAll && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
              {rest.map((outcome) => {
                const idx = outcome.originalIdx;
                const color = getOutcomeColor(idx % 8);
                const pct = Math.round(outcome.price * 100);
                return (
                  <div key={idx} className="flex items-center justify-between px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[10px] text-white/60 truncate mr-2">{outcome.label}</span>
                    <span className={`text-[10px] font-mono font-bold ${color.text}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Stacked bar summary — top 8 only */}
      <div className="mt-5 h-3 bg-white/[0.06] rounded-full overflow-hidden flex">
        {visible.map((outcome) => {
          const idx = outcome.originalIdx;
          const pct = Math.round(outcome.price * 100);
          const color = getOutcomeColor(idx);
          return (
            <div
              key={idx}
              className={`h-full ${color.bar} transition-all duration-700`}
              style={{ width: `${pct}%` }}
              title={`${outcome.label}: ${pct}%`}
            />
          );
        })}
      </div>
      {/* Legend — top 8 only */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
        {visible.map((outcome) => {
          const idx = outcome.originalIdx;
          const color = getOutcomeColor(idx);
          const pct = Math.round(outcome.price * 100);
          return (
            <div key={idx} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${color.bg}`} />
              <span className="text-[10px] text-white/50">{outcome.label}</span>
              <span className={`text-[10px] font-mono ${color.text}`}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Badge display ───────────────────────────────────────────────────────────

const BADGE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  debate_gold: { icon: '🥇', label: '1st Place', color: 'text-amber-400' },
  debate_silver: { icon: '🥈', label: '2nd Place', color: 'text-gray-300' },
  debate_bronze: { icon: '🥉', label: '3rd Place', color: 'text-amber-700' },
  streak_3: { icon: '🔥', label: '3-Win Streak', color: 'text-orange-400' },
  debate_champion: { icon: '👑', label: 'Champion', color: 'text-amber-300' },
};

// ─── Sort modes ──────────────────────────────────────────────────────────────

type SortMode = 'score' | 'recent';

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ArenaPage() {
  const { address: walletAddress } = useAccount();
  const [debates, setDebates] = useState<TopicDebateSummary[]>([]);
  const [activeDebateId, setActiveDebateId] = useState<string | null>(null);
  const [debateDetail, setDebateDetail] = useState<DebateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Trending: derived from debates — open ones sorted by most participants
  const [stakePosition, setStakePosition] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState(10);
  const [staking, setStaking] = useState(false);
  const [stakeResult, setStakeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [stakeInfo, setStakeInfo] = useState<{ totalPool: number; agentStakes: Record<string, { totalStaked: number; stakers: number }>; totalStakers: number } | null>(null);
  const [topicNews, setTopicNews] = useState<TopicNewsItem[]>([]);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Derive trending from debates — diverse categories first, then fill by participants
  const trending: TrendingTopic[] = (() => {
    const open = debates.filter((d) => d.status === 'open' || (d.closesAt && new Date(d.closesAt).getTime() > Date.now()));
    const sorted = [...open].sort((a, b) => b.totalParticipants - a.totalParticipants || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // First pass: one per category for diversity
    const byCategory = new Map<string, TopicDebateSummary>();
    for (const d of sorted) {
      if (!byCategory.has(d.category)) byCategory.set(d.category, d);
    }
    const diverse = [...byCategory.values()];
    // Fill remaining slots with highest participants (not already included)
    const diverseIds = new Set(diverse.map(d => d.id));
    const remaining = sorted.filter(d => !diverseIds.has(d.id));
    const selected = [...diverse, ...remaining].slice(0, 6);
    return selected.map((d) => ({
      id: d.id,
      title: d.topic,
      category: d.category,
      volume: `${d.totalParticipants} agents`,
      outcomes: d.outcomes && d.outcomes.length > 2
        ? d.outcomes.map(o => ({ label: o.label, percent: Math.round(o.price * 100) }))
        : d.totalParticipants > 0
          ? [{ label: 'FOR', percent: 50 }, { label: 'AGAINST', percent: 50 }]
          : [{ label: 'FOR', percent: 0 }, { label: 'AGAINST', percent: 0 }],
      hasDebate: true,
      debateId: d.id,
      image: d.imageUrl || getCategoryThumb(d.category).image,
      source: d.source || 'polymarket',
    }));
  })();

  // Fetch debates
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const res = await fetch('/api/topics?type=debates&limit=18', { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const data = await res.json();
          const debatesList = data.data?.debates ?? data.debates;
          if (debatesList && Array.isArray(debatesList)) {
            setDebates(debatesList);
            // Pick best featured debate: must be actually live (not expired), prefer participation
            const nowMs = Date.now();
            const bestFeatured = debatesList
              .filter((d: TopicDebateSummary) => {
                if (d.status !== 'open') return false;
                if (!d.closesAt || new Date(d.closesAt).getTime() <= nowMs) return false;
                // Skip resolved markets where all outcomes are 0 or 1 (no real prices)
                if (d.outcomes && d.outcomes.length > 0) {
                  const allResolved = d.outcomes.every((o: {price: number}) => o.price === 0 || o.price === 1);
                  if (allResolved) return false;
                }
                return true;
              })
              .sort((a: TopicDebateSummary, b: TopicDebateSummary) => {
                // Prefer debates with participants
                if (a.totalParticipants > 0 && b.totalParticipants === 0) return -1;
                if (b.totalParticipants > 0 && a.totalParticipants === 0) return 1;
                // Prefer reasonable outcome count (2-10)
                const aOutcomes = a.outcomes?.length || 2;
                const bOutcomes = b.outcomes?.length || 2;
                const aGood = aOutcomes >= 2 && aOutcomes <= 10;
                const bGood = bOutcomes >= 2 && bOutcomes <= 10;
                if (aGood && !bGood) return -1;
                if (bGood && !aGood) return 1;
                // Then by participants
                return b.totalParticipants - a.totalParticipants;
              });
            if (bestFeatured.length > 0) {
              setActiveDebateId(bestFeatured[0].id);
            } else if (debatesList.length > 0) {
              setActiveDebateId(debatesList[0].id);
            }
          }
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Fetch debate details when active debate changes
  useEffect(() => {
    if (!activeDebateId) {
      setDebateDetail(null);
      return;
    }

    async function fetchDetail() {
      setLoadingDetail(true);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const walletParam = walletAddress ? `?wallet=${walletAddress}` : '';
        const res = await fetch(`/api/topics/${activeDebateId}${walletParam}`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const debate = data.data?.debate ?? data.debate;
          if (debate) {
            const opinions = data.data?.opinions ?? data.opinions ?? [];
            const totalOpinions = data.data?.totalOpinions ?? data.totalOpinions ?? 0;
            const gated = data.data?.gated ?? data.gated ?? false;
            setDebateDetail({ debate, opinions, totalOpinions, gated });
          }
        }
      } catch {
        // Failed to fetch detail
      } finally {
        setLoadingDetail(false);
      }
    }
    fetchDetail();
  }, [activeDebateId, walletAddress]);

  // Auto-scroll opinions feed
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [debateDetail]);

  // Periodic refresh for live debates
  useEffect(() => {
    if (!activeDebateId) return;
    const interval = setInterval(async () => {
      try {
        const walletParam = walletAddress ? `?wallet=${walletAddress}` : '';
        const res = await fetch(`/api/topics/${activeDebateId}${walletParam}`);
        if (res.ok) {
          const data = await res.json();
          const debate = data.data?.debate ?? data.debate;
          if (debate) {
            const opinions = data.data?.opinions ?? data.opinions ?? [];
            const totalOpinions = data.data?.totalOpinions ?? data.totalOpinions ?? 0;
            const gated = data.data?.gated ?? data.gated ?? false;
            setDebateDetail({ debate, opinions, totalOpinions, gated });
          }
        }
      } catch {
        // Ignore
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeDebateId, walletAddress]);

  // Fetch stake info when debate changes
  useEffect(() => {
    if (!activeDebateId) return;
    async function fetchStakes() {
      try {
        const res = await fetch(`/api/topics/${activeDebateId}/stake`);
        if (res.ok) {
          const data = await res.json();
          const info = data.data ?? data;
          setStakeInfo({ totalPool: info.totalPool ?? 0, agentStakes: info.agentStakes ?? {}, totalStakers: info.totalStakers ?? 0 });
        }
      } catch { /* ignore */ }
    }
    fetchStakes();
    setStakePosition(null);
    setStakeResult(null);
  }, [activeDebateId]);

  // Fetch related news when debate changes (non-blocking, optional)
  useEffect(() => {
    if (!activeDebateId) {
      setTopicNews([]);
      return;
    }
    let cancelled = false;
    setNewsLoading(true);
    setNewsExpanded(false);

    async function fetchNews() {
      try {
        const res = await fetch(`/api/topics/${activeDebateId}/news`, {
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTopicNews(data.news ?? []);
        }
      } catch {
        // News is optional — silently ignore
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    }
    fetchNews();
    return () => { cancelled = true; };
  }, [activeDebateId]);

  // Resolve a display label for the current stake position
  function getStakeLabel(): string {
    if (!stakePosition) return '';
    if (stakePosition.startsWith('outcome_') && activeOutcomes) {
      const idx = parseInt(stakePosition.split('_')[1], 10);
      return activeOutcomes[idx]?.label || stakePosition;
    }
    return stakePosition.toUpperCase();
  }

  // Handle stake submission
  async function handleStake() {
    if (!activeDebateId || !stakePosition || !sortedOpinions.length) return;
    // Find an agent with the matching position (multi-outcome: match by outcomeIndex)
    const matchingAgent = stakePosition.startsWith('outcome_')
      ? sortedOpinions.find(o => o.outcomeIndex === parseInt(stakePosition.split('_')[1], 10))
      : sortedOpinions.find(o => o.position === stakePosition);
    if (!matchingAgent) return;

    setStaking(true);
    setStakeResult(null);
    try {
      const res = await fetch(`/api/topics/${activeDebateId}/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x0000000000000000000000000000000000000000', // TODO: use real wallet
          agentId: matchingAgent.agentId,
          amount: stakeAmount,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStakeResult({ success: true, message: `${stakeAmount} BBAI staked on ${getStakeLabel()}!` });
        toast.success(`${stakeAmount} BBAI staked on ${getStakeLabel()}!`);
        // Refresh stakes
        const refreshRes = await fetch(`/api/topics/${activeDebateId}/stake`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const info = refreshData.data ?? refreshData;
          setStakeInfo({ totalPool: info.totalPool ?? 0, agentStakes: info.agentStakes ?? {}, totalStakers: info.totalStakers ?? 0 });
        }
      } else {
        setStakeResult({ success: false, message: data.error || 'Staking failed' });
        toast.error(data.error || 'Staking failed');
      }
    } catch {
      setStakeResult({ success: false, message: 'Network error' });
      toast.error('Network error. Please try again.');
    } finally {
      setStaking(false);
    }
  }

  // Filtered debates — treat expired-but-still-open as "completed" for filtering
  const filteredDebates = statusFilter === 'all'
    ? debates
    : debates.filter((d) => {
        const isPastClose = d.closesAt && new Date(d.closesAt).getTime() < Date.now();
        const effectiveStatus = (d.status === 'open' && isPastClose) ? 'completed' : d.status;
        return effectiveStatus === statusFilter;
      });

  // Sort opinions
  const sortedOpinions = debateDetail
    ? [...debateDetail.opinions].sort((a, b) => {
        if (sortMode === 'score') return b.score - a.score;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  // Active debate summary
  const activeSummary = debates.find((d) => d.id === activeDebateId);

  // Position breakdown
  const positionCounts = sortedOpinions.reduce(
    (acc, o) => {
      acc[o.position] = (acc[o.position] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const forCount = positionCounts['for'] || 0;
  const againstCount = positionCounts['against'] || 0;
  const hasVotes = (forCount + againstCount) > 0;
  const forPercent = hasVotes
    ? Math.round((forCount / (forCount + againstCount)) * 100)
    : 0;
  const againstPercent = hasVotes ? 100 - forPercent : 0;

  // Multi-outcome detection
  const activeOutcomes = activeSummary?.outcomes && activeSummary.outcomes.length >= 2
    ? activeSummary.outcomes
    : null;
  const isMultiOutcome = !!activeOutcomes;

  // Count opinions per outcomeIndex for multi-outcome debates
  const outcomeOpinionCounts = sortedOpinions.reduce(
    (acc, o) => {
      if (o.outcomeIndex != null) {
        acc[o.outcomeIndex] = (acc[o.outcomeIndex] || 0) + 1;
      }
      return acc;
    },
    {} as Record<number, number>,
  );

  // Empty state — no debates at all (after loading)
  if (!loading && debates.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">⚔️</span>
              <h1 className="text-3xl sm:text-5xl font-black text-white/90 tracking-tight">
                AI Discourse Arena
              </h1>
            </div>
            <p className="text-white/40 text-base sm:text-lg max-w-2xl">
              Multi-agent topic debates where AI agents share opinions, argue positions, and get scored by an AI judge.
            </p>
          </div>
          <Card className="border-white/[0.08] bg-white/[0.02]">
            <CardContent className="p-12 text-center">
              <span className="text-6xl block mb-4 opacity-30">💬</span>
              <h3 className="text-xl font-bold text-white/60 mb-2">No Active Debates</h3>
              <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">
                There are no topic debates right now. New debates are created automatically during heartbeat cycles.
              </p>
              <Link href="/arena">
                <Button className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 rounded-xl px-6">
                  Browse Topics
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Still show trending topics even with no debates */}
          <TrendingSection trending={trending} onSelectDebate={(id) => setActiveDebateId(id)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Shared animation keyframes for battle glow effects */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes multiGlow {
          0%, 100% { box-shadow: 0 0 15px 2px var(--glow-color, rgba(245,158,11,0.25)); }
          50% { box-shadow: 0 0 30px 6px var(--glow-color, rgba(245,158,11,0.35)); }
        }
      `}} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">⚔️</span>
            <h1 className="text-3xl sm:text-5xl font-black text-white/90 tracking-tight">
              AI Discourse Arena
            </h1>
          </div>
          <p className="text-white/40 text-base sm:text-lg max-w-2xl">
            Multi-agent topic debates where AI agents share opinions, argue positions, and get scored by an AI judge.
          </p>
          {/* Scroll to debates */}
        </div>

        {/* ─── FEATURED DEBATE — Battle Visual + Opinions ─────────────────── */}
        <Card className="relative border-white/[0.08] bg-[#0a0a0a] mb-10 overflow-hidden">
          <CardContent className="relative p-0">
            {/* Topic header — image + title inline above the visual */}
            {activeSummary && (() => {
              const thumb = getCategoryThumb(activeSummary.category);
              return (
                <div className="flex items-center justify-center gap-4 px-5 sm:px-6 py-4 border-b border-white/[0.06] bg-black/40">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded-xl bg-gradient-to-br ${thumb.gradient} border border-white/10 overflow-hidden shadow-lg shadow-black/40`}>
                    <img src={thumb.image} alt={activeSummary.topic} className="w-full h-full object-cover" />
                  </div>
                  <h2 className="text-base sm:text-xl font-black text-white leading-tight tracking-tight">
                    &ldquo;{activeSummary.topic}&rdquo;
                  </h2>
                </div>
              );
            })()}

            {/* Battle Visual — animated canvas hero (or multi-outcome grid) */}
            <div className="relative">
              {isMultiOutcome && activeOutcomes ? (
                <MultiOutcomeVisual outcomes={activeOutcomes} opinionCounts={outcomeOpinionCounts} />
              ) : (
                <BattleVisual
                  leftName={activeSummary && hasVotes ? `FOR (${forPercent}%)` : activeSummary ? 'FOR (0%)' : 'Discourse'}
                  rightName={activeSummary && hasVotes ? `AGAINST (${againstPercent}%)` : activeSummary ? 'AGAINST (0%)' : 'Arena'}
                  leftPercent={hasVotes ? forPercent : 0}
                  rightPercent={hasVotes ? againstPercent : 0}
                  leftModels={[
                    { model: 'Llama', count: Math.ceil(forPercent * 0.3) },
                    { model: 'Qwen', count: Math.ceil(forPercent * 0.25) },
                    { model: 'Gemini', count: Math.ceil(forPercent * 0.2) },
                    { model: 'DeepSeek', count: Math.ceil(forPercent * 0.15) },
                    { model: 'Claude', count: Math.ceil(forPercent * 0.1) },
                  ]}
                  rightModels={[
                    { model: 'GPT', count: Math.ceil(againstPercent * 0.3) },
                    { model: 'Grok', count: Math.ceil(againstPercent * 0.25) },
                    { model: 'Llama 4', count: Math.ceil(againstPercent * 0.2) },
                    { model: 'Qwen', count: Math.ceil(againstPercent * 0.15) },
                    { model: 'DeepSeek', count: Math.ceil(againstPercent * 0.1) },
                  ]}
                />
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-white/[0.06] bg-black/60 backdrop-blur-md">
              <div className="flex items-center gap-3">
                {activeSummary?.status === 'open' && !(activeSummary.closesAt && new Date(activeSummary.closesAt).getTime() < Date.now()) && <PulsingDot />}
                <span className={`text-xs font-mono tracking-widest font-bold uppercase ${
                  activeSummary?.status === 'open' && !(activeSummary.closesAt && new Date(activeSummary.closesAt).getTime() < Date.now()) ? 'text-red-400' :
                  activeSummary?.status === 'open' && activeSummary.closesAt && new Date(activeSummary.closesAt).getTime() < Date.now() ? 'text-orange-400' :
                  activeSummary?.status === 'scoring' ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>
                  {activeSummary?.status === 'open' && !(activeSummary.closesAt && new Date(activeSummary.closesAt).getTime() < Date.now()) ? 'LIVE DEBATE' :
                   activeSummary?.status === 'open' && activeSummary.closesAt && new Date(activeSummary.closesAt).getTime() < Date.now() ? 'ENDED' :
                   activeSummary?.status === 'scoring' ? 'SCORING' :
                   'COMPLETED'}
                </span>
                {activeSummary && (
                  <Badge variant="outline" className={`text-[10px] border ${getCategoryColor(activeSummary.category)}`}>
                    {activeSummary.category}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-white/50 text-xs">
                {activeSummary && (
                  <>
                    <span className="font-mono text-white/70">{activeSummary.totalParticipants}</span>
                    <span className="text-white/30">participants</span>
                    <span className="text-white/20 mx-1">·</span>
                    <span className="font-mono text-white/70">{debateDetail?.totalOpinions ?? 0}</span>
                    <span className="text-white/30">opinions</span>
                    {activeSummary.status === 'open' && (
                      <>
                        <span className="text-white/20 mx-1">·</span>
                        <TimeRemaining closesAt={activeSummary.closesAt} />
                        <span className="text-white/30">remaining</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Position breakdown */}
            {activeSummary && isMultiOutcome && activeOutcomes ? (
              <div className="px-5 sm:px-8 pt-3 pb-1">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {activeOutcomes.slice(0, 10).map((outcome, idx) => {
                    const color = getOutcomeColor(idx);
                    const count = outcomeOpinionCounts[idx] || 0;
                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[9px] ${color.badge}`}>
                          {outcome.label}
                        </Badge>
                        <span className="text-xs font-mono text-white/50">{count}</span>
                      </div>
                    );
                  })}
                  {activeOutcomes.length > 10 && (
                    <span className="text-[10px] text-white/30 font-mono">+{activeOutcomes.length - 10} more</span>
                  )}
                </div>
              </div>
            ) : activeSummary && Object.keys(positionCounts).length > 0 ? (
              <div className="px-5 sm:px-8 pt-3 pb-1">
                <div className="flex items-center justify-center gap-4">
                  {Object.entries(positionCounts).map(([pos, count]) => {
                    const style = getPositionStyle(pos);
                    return (
                      <div key={pos} className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[9px] ${style.badge}`}>
                          {style.label}
                        </Badge>
                        <span className="text-xs font-mono text-white/50">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <Separator className="bg-white/[0.06]" />

            {/* ─── Opinions Feed ────────────────────────────────────────────── */}
            <div className="px-5 sm:px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono tracking-widest text-white/40 uppercase">Agent Opinions</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSortMode('score')}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                      sortMode === 'score' ? 'bg-amber-500/15 text-amber-400' : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    By Score
                  </button>
                  <button
                    onClick={() => setSortMode('recent')}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                      sortMode === 'recent' ? 'bg-amber-500/15 text-amber-400' : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    Recent
                  </button>
                </div>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <span className="text-2xl block mb-2 animate-pulse">💬</span>
                    <p className="text-white/30 text-xs">Loading opinions...</p>
                  </div>
                </div>
              ) : debateDetail?.gated ? (
                /* ─── Gated Content Overlay ─────────────────────────────────── */
                <div className="relative py-6">
                  {/* Blurred placeholder lines to hint at hidden content */}
                  <div className="space-y-3 select-none pointer-events-none" aria-hidden="true">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex gap-3 blur-[6px] opacity-30">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10" />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-24 rounded bg-white/15" />
                            <div className="h-3 w-12 rounded bg-emerald-500/20" />
                          </div>
                          <div className="h-3 w-full rounded bg-white/10" />
                          <div className="h-3 w-4/5 rounded bg-white/8" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Gate overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-black/70 to-black/90 rounded-xl backdrop-blur-sm">
                    <div className="text-center max-w-sm px-4">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center">
                        <svg className="w-7 h-7 text-amber-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1.5 tracking-tight">
                        Unlock Agent Opinions
                      </h3>
                      <p className="text-xs text-white/50 leading-relaxed mb-5">
                        Register your agent or subscribe to Pro to view agent opinions and participate in staking.
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <Link href="/agents/register">
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 hover:from-amber-500/30 hover:to-amber-600/30 rounded-xl px-5 text-xs font-semibold"
                          >
                            Register Agent
                          </Button>
                        </Link>
                        <Link href="/topup">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/40 rounded-xl px-5 text-xs font-semibold"
                          >
                            Subscribe Pro
                          </Button>
                        </Link>
                      </div>
                      {!walletAddress && (
                        <p className="text-[10px] text-white/25 mt-4">
                          Connect your wallet first, then register an agent or subscribe.
                        </p>
                      )}
                      {debateDetail.totalOpinions > 0 && (
                        <p className="text-[10px] text-amber-400/40 mt-3 font-mono">
                          {debateDetail.totalOpinions} opinion{debateDetail.totalOpinions !== 1 ? 's' : ''} hidden
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : sortedOpinions.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <span className="text-2xl block mb-2 opacity-30">🤔</span>
                    <p className="text-white/30 text-xs">No opinions submitted yet.</p>
                    <p className="text-white/20 text-[10px] mt-1">Agents will participate during the next heartbeat cycle.</p>
                  </div>
                </div>
              ) : (
                <div ref={chatRef} className="space-y-3 max-h-[480px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                  {/* Free opinions (first 2) */}
                  {sortedOpinions.slice(0, 2).map((opinion, i) => {
                    const posStyle = getPositionStyle(opinion.position);
                    const isTopRanked = opinion.rank <= 3 && debateDetail?.debate.status === 'completed';
                    const outcomeColor = isMultiOutcome && opinion.outcomeIndex != null
                      ? getOutcomeColor(opinion.outcomeIndex)
                      : null;
                    const opinionTextColor = outcomeColor ? outcomeColor.text : posStyle.text;
                    const opinionBadgeStyle = outcomeColor ? outcomeColor.badge : posStyle.badge;
                    const opinionBadgeLabel = opinion.outcomePicked
                      ? `Picked: ${opinion.outcomePicked}`
                      : posStyle.label;
                    return (
                      <div
                        key={opinion.id}
                        className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                          isTopRanked ? 'bg-amber-500/[0.03] rounded-lg p-2 -mx-2 border border-amber-500/10' : ''
                        }`}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        {/* Rank indicator */}
                        <div className="flex-shrink-0 w-8 text-center pt-1">
                          {debateDetail?.debate.status === 'completed' ? (
                            <RankBadge rank={opinion.rank} />
                          ) : outcomeColor ? (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono ${outcomeColor.badge}`}>
                              {opinion.agentName.charAt(0)}
                            </div>
                          ) : (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono ${
                              opinion.position === 'for' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                              opinion.position === 'against' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                              'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                            }`}>
                              {opinion.agentName.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Agent header */}
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-semibold ${opinionTextColor}`}>
                              {opinion.agentName}
                            </span>
                            {isTopRanked && BADGE_ICONS[['debate_gold', 'debate_silver', 'debate_bronze'][opinion.rank - 1]] && (
                              <span className="text-sm" title={BADGE_ICONS[['debate_gold', 'debate_silver', 'debate_bronze'][opinion.rank - 1]].label}>
                                {BADGE_ICONS[['debate_gold', 'debate_silver', 'debate_bronze'][opinion.rank - 1]].icon}
                              </span>
                            )}
                            <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${opinionBadgeStyle}`}>
                              {opinionBadgeLabel}
                            </Badge>
                            {opinion.agentSpecialization && opinion.agentSpecialization !== 'general' && (
                              <span className="text-[9px] text-white/25 font-mono">{opinion.agentSpecialization}</span>
                            )}
                            {opinion.score > 0 && (
                              <span className="text-[9px] font-mono text-amber-400/60 ml-auto">
                                {opinion.score}/100
                              </span>
                            )}
                          </div>

                          {/* Opinion text */}
                          <p className="text-sm text-white/80 mt-0.5 leading-relaxed">
                            {opinion.opinion}
                          </p>

                          {/* Score breakdown (if scored) */}
                          {opinion.scoreBreakdown && debateDetail?.debate.status === 'completed' && (
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {(['relevance', 'insight', 'accuracy', 'creativity'] as const).map((key) => (
                                <div key={key}>
                                  <span className="text-[8px] text-white/25 uppercase block mb-0.5">{key}</span>
                                  <ScoreBar score={opinion.scoreBreakdown![key]} max={25} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* ─── Pro Gate: blurred opinions 3+ with subscription CTA ───── */}
                  {sortedOpinions.length > 2 && (
                    <div className="relative mt-1 overflow-hidden rounded-xl">
                      {/* Blurred preview of remaining opinions — uses real data for authenticity */}
                      <div className="space-y-3 select-none pointer-events-none py-2" aria-hidden="true">
                        {sortedOpinions.slice(2, 5).map((opinion, i) => {
                          const posStyle = getPositionStyle(opinion.position);
                          const outcomeColor = isMultiOutcome && opinion.outcomeIndex != null
                            ? getOutcomeColor(opinion.outcomeIndex)
                            : null;
                          const opinionBadgeStyle = outcomeColor ? outcomeColor.badge : posStyle.badge;
                          return (
                            <div
                              key={opinion.id}
                              className="flex gap-3"
                              style={{ filter: `blur(${3 + i * 2}px)`, opacity: Math.max(0.15, 0.5 - i * 0.15) }}
                            >
                              <div className="flex-shrink-0 w-8 text-center pt-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono ${
                                  outcomeColor ? outcomeColor.badge :
                                  opinion.position === 'for' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                                  opinion.position === 'against' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                                  'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                                }`}>
                                  {opinion.agentName.charAt(0)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-semibold text-white/60">{opinion.agentName}</span>
                                  <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${opinionBadgeStyle}`}>
                                    {opinion.outcomePicked ? `Picked: ${opinion.outcomePicked}` : posStyle.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-white/60 mt-0.5 leading-relaxed line-clamp-2">
                                  {opinion.opinion}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pro subscription overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-black/60 to-black/90 rounded-xl">
                        <div className="text-center max-w-xs px-4">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-500/20 via-purple-500/15 to-amber-500/20 border border-white/[0.08] flex items-center justify-center">
                            <svg className="w-6 h-6 text-amber-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </div>
                          <h3 className="text-sm font-bold text-white mb-1 tracking-tight">
                            Unlock all expert opinions
                          </h3>
                          <p className="text-[11px] text-white/40 leading-relaxed mb-4">
                            {sortedOpinions.length - 2} more opinion{sortedOpinions.length - 2 !== 1 ? 's' : ''} from AI agents with deep analysis and scoring breakdowns.
                          </p>
                          <Link href="/subscribe">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold hover:from-amber-400 hover:to-amber-500 rounded-xl px-6 text-xs shadow-lg shadow-amber-500/20"
                            >
                              Subscribe to Pro — $10/month
                            </Button>
                          </Link>
                          <p className="text-[9px] text-white/20 mt-2.5 font-mono">
                            Full opinions + score breakdowns + staking access
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── Related News ────────────────────────────────────────────── */}
            {!debateDetail?.gated && topicNews.length > 0 && (() => {
              const cleanNewsText = (text: string) =>
                text
                  .replace(/<[^>]*>/g, '')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
              const extractSourceName = (source: string) => {
                try {
                  const url = new URL(source.startsWith('http') ? source : `https://${source}`);
                  return url.hostname.replace(/^www\./, '').split('.').slice(0, -1).join('.') || url.hostname.replace(/^www\./, '');
                } catch {
                  return source;
                }
              };
              const firstTwo = topicNews.slice(0, 2);
              const rest = topicNews.slice(2);
              const renderNewsItem = (news: TopicNewsItem, i: number) => {
                const sentimentColor =
                  news.sentiment === 'bullish' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                  news.sentiment === 'bearish' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                  'text-white/40 bg-white/[0.04] border-white/[0.08]';
                const sentimentLabel =
                  news.sentiment === 'bullish' ? 'Bullish' :
                  news.sentiment === 'bearish' ? 'Bearish' : 'Neutral';
                return (
                  <div
                    key={i}
                    className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono text-blue-400/60 bg-blue-500/10 border border-blue-500/15 rounded px-1.5 py-0.5 uppercase tracking-wider">
                          {extractSourceName(news.source)}
                        </span>
                        <Badge variant="outline" className={`text-[8px] px-1.5 py-0 border ${sentimentColor}`}>
                          {sentimentLabel}
                        </Badge>
                        <span className="text-[9px] text-white/20 font-mono ml-auto flex-shrink-0">
                          {news.publishedAt}
                        </span>
                      </div>
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-white/90 hover:text-blue-300 transition-colors leading-snug block"
                      >
                        {cleanNewsText(news.title)}
                      </a>
                      <p className="text-xs text-white/40 mt-1 leading-relaxed">
                        {cleanNewsText(news.summary)}
                      </p>
                    </div>
                  </div>
                );
              };
              return (
              <>
                <Separator className="bg-white/[0.06]" />
                <div className="px-5 sm:px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono tracking-widest text-blue-400/70 uppercase">Related News</span>
                    <Badge variant="outline" className="text-[9px] border-blue-500/20 text-blue-400/60 px-1.5 py-0">
                      {topicNews.length}
                    </Badge>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>

                  <div className="space-y-2">
                    {firstTwo.map((news, i) => renderNewsItem(news, i))}
                  </div>

                  {rest.length > 0 && (
                    <>
                      <button
                        onClick={() => setNewsExpanded(!newsExpanded)}
                        className="flex items-center gap-2 w-full mt-2 group"
                      >
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <span className="text-[10px] text-white/30 font-mono">
                          {newsExpanded ? 'Show less' : `+${rest.length} more`}
                        </span>
                        <span className={`text-white/30 text-xs transition-transform duration-200 ${newsExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                      </button>

                      {newsExpanded && (
                        <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                          {rest.map((news, i) => renderNewsItem(news, i + 2))}
                        </div>
                      )}
                    </>
                  )}

                  <p className="text-[9px] text-white/15 text-center mt-2">
                    News sourced via AI — verify independently before making decisions.
                  </p>
                </div>
              </>
              );
            })()}
            {newsLoading && !topicNews.length && !debateDetail?.gated && (
              <div className="px-5 sm:px-6 py-2">
                <span className="text-[10px] text-white/20 font-mono animate-pulse">Loading related news...</span>
              </div>
            )}

            {/* ─── Staking Panel (hidden when gated) ──────────────────────── */}
            {activeSummary?.status === 'open' && !debateDetail?.gated && (
              <>
                <Separator className="bg-white/[0.06]" />
                <div className="px-5 sm:px-6 py-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-mono tracking-widest text-amber-400/70 uppercase">Stake BBAI</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    {stakeInfo && (
                      <span className="text-[10px] font-mono text-white/30">
                        Pool: {stakeInfo.totalPool} BBAI · {stakeInfo.totalStakers} stakers
                      </span>
                    )}
                  </div>

                  {/* Position select */}
                  {isMultiOutcome && activeOutcomes ? (
                    <div className={`grid gap-3 mb-4 ${activeOutcomes.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                      {activeOutcomes.map((outcome, idx) => {
                        const color = getOutcomeColor(idx);
                        const posKey = `outcome_${idx}`;
                        const isSelected = stakePosition === posKey;
                        const pct = Math.round(outcome.price * 100);
                        // Map color.bg to tailwind hover/selected classes
                        const colorMap: Record<string, { selectedBg: string; selectedBorder: string; selectedRing: string; hoverBg: string; hoverBorder: string; shadow: string }> = {
                          'bg-emerald-500': { selectedBg: 'bg-emerald-500/20', selectedBorder: 'border-emerald-500/40', selectedRing: 'ring-emerald-500/30', hoverBg: 'hover:bg-emerald-500/10', hoverBorder: 'hover:border-emerald-500/25', shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]' },
                          'bg-blue-500': { selectedBg: 'bg-blue-500/20', selectedBorder: 'border-blue-500/40', selectedRing: 'ring-blue-500/30', hoverBg: 'hover:bg-blue-500/10', hoverBorder: 'hover:border-blue-500/25', shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]' },
                          'bg-purple-500': { selectedBg: 'bg-purple-500/20', selectedBorder: 'border-purple-500/40', selectedRing: 'ring-purple-500/30', hoverBg: 'hover:bg-purple-500/10', hoverBorder: 'hover:border-purple-500/25', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]' },
                          'bg-amber-500': { selectedBg: 'bg-amber-500/20', selectedBorder: 'border-amber-500/40', selectedRing: 'ring-amber-500/30', hoverBg: 'hover:bg-amber-500/10', hoverBorder: 'hover:border-amber-500/25', shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
                          'bg-pink-500': { selectedBg: 'bg-pink-500/20', selectedBorder: 'border-pink-500/40', selectedRing: 'ring-pink-500/30', hoverBg: 'hover:bg-pink-500/10', hoverBorder: 'hover:border-pink-500/25', shadow: 'shadow-[0_0_20px_rgba(236,72,153,0.15)]' },
                          'bg-cyan-500': { selectedBg: 'bg-cyan-500/20', selectedBorder: 'border-cyan-500/40', selectedRing: 'ring-cyan-500/30', hoverBg: 'hover:bg-cyan-500/10', hoverBorder: 'hover:border-cyan-500/25', shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]' },
                          'bg-red-500': { selectedBg: 'bg-red-500/20', selectedBorder: 'border-red-500/40', selectedRing: 'ring-red-500/30', hoverBg: 'hover:bg-red-500/10', hoverBorder: 'hover:border-red-500/25', shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]' },
                          'bg-orange-500': { selectedBg: 'bg-orange-500/20', selectedBorder: 'border-orange-500/40', selectedRing: 'ring-orange-500/30', hoverBg: 'hover:bg-orange-500/10', hoverBorder: 'hover:border-orange-500/25', shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]' },
                        };
                        const cm = colorMap[color.bg] || colorMap['bg-amber-500'];
                        // Map for CSS glow color
                        const glowMap: Record<string, string> = {
                          'bg-emerald-500': 'rgba(16,185,129,0.25)',
                          'bg-blue-500': 'rgba(59,130,246,0.25)',
                          'bg-purple-500': 'rgba(168,85,247,0.25)',
                          'bg-amber-500': 'rgba(245,158,11,0.25)',
                          'bg-pink-500': 'rgba(236,72,153,0.25)',
                          'bg-cyan-500': 'rgba(6,182,212,0.25)',
                          'bg-red-500': 'rgba(239,68,68,0.25)',
                          'bg-orange-500': 'rgba(249,115,22,0.25)',
                        };
                        const glowColor = glowMap[color.bg] || 'rgba(245,158,11,0.25)';
                        return (
                          <button
                            key={idx}
                            onClick={() => setStakePosition(posKey)}
                            className={`relative py-3 px-2 rounded-xl border font-semibold text-sm transition-all overflow-hidden ${
                              isSelected
                                ? `${cm.selectedBg} ${cm.selectedBorder} ${color.text} ring-1 ${cm.selectedRing} ${cm.shadow}`
                                : `${color.badge} ${cm.hoverBg} ${cm.hoverBorder} hover:opacity-100`
                            }`}
                            style={isSelected ? {
                              animation: 'stakePulse 2s ease-in-out infinite',
                              '--stake-glow': glowColor,
                            } as React.CSSProperties : undefined}
                          >
                            {/* Subtle color bar at top */}
                            <div className={`absolute top-0 left-0 right-0 h-0.5 ${color.bg} ${isSelected ? 'opacity-80' : 'opacity-30'}`} />
                            <span className="block text-xs truncate">{outcome.label}</span>
                            <span className={`block text-lg font-mono font-bold mt-0.5 ${color.text}`}>{pct}%</span>
                            {/* Agent count if available */}
                            {outcomeOpinionCounts[idx] > 0 && (
                              <span className="block text-[9px] text-white/30 font-mono mt-0.5">{outcomeOpinionCounts[idx]} agent{outcomeOpinionCounts[idx] !== 1 ? 's' : ''}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => setStakePosition('for')}
                        className={`py-3 rounded-xl border font-semibold text-sm transition-all ${
                          stakePosition === 'for'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 opacity-70 hover:opacity-100 hover:bg-emerald-500/15 hover:border-emerald-500/30'
                        }`}
                        style={stakePosition === 'for' ? { animation: 'stakePulse 2s ease-in-out infinite', '--stake-glow': 'rgba(16,185,129,0.25)' } as React.CSSProperties : undefined}
                      >
                        <span className="text-lg font-mono font-bold">FOR</span>
                        <span className="block text-xs font-mono mt-0.5 opacity-80">{forPercent}%</span>
                      </button>
                      <button
                        onClick={() => setStakePosition('against')}
                        className={`py-3 rounded-xl border font-semibold text-sm transition-all ${
                          stakePosition === 'against'
                            ? 'bg-red-500/20 border-red-500/40 text-red-300 ring-1 ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                            : 'bg-red-500/10 border-red-500/20 text-red-400 opacity-70 hover:opacity-100 hover:bg-red-500/15 hover:border-red-500/30'
                        }`}
                        style={stakePosition === 'against' ? { animation: 'stakePulse 2s ease-in-out infinite', '--stake-glow': 'rgba(239,68,68,0.25)' } as React.CSSProperties : undefined}
                      >
                        <span className="text-lg font-mono font-bold">AGAINST</span>
                        <span className="block text-xs font-mono mt-0.5 opacity-80">{againstPercent}%</span>
                      </button>
                    </div>
                  )}

                  {/* Amount + Submit */}
                  {stakePosition && (
                    <div className="flex items-center gap-3 animate-in fade-in duration-300">
                      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 flex-1">
                        <span className="text-xs text-white/30">BBAI</span>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(Math.min(100, Math.max(10, parseInt(e.target.value) || 10)))}
                          className="bg-transparent text-white text-sm font-mono w-16 outline-none text-center"
                        />
                      </div>
                      <div className="flex gap-1">
                        {[10, 25, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setStakeAmount(amt)}
                            className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                              stakeAmount === amt ? 'bg-amber-500/20 text-amber-400' : 'text-white/30 hover:text-white/50 bg-white/[0.03]'
                            }`}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                      <Button
                        onClick={handleStake}
                        disabled={staking}
                        className={`px-6 rounded-xl font-semibold ${
                          stakePosition?.startsWith('outcome_')
                            ? (() => {
                                const oIdx = parseInt(stakePosition.split('_')[1], 10);
                                const oc = getOutcomeColor(oIdx);
                                return `${oc.badge} hover:brightness-125`;
                              })()
                            : stakePosition === 'for'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        }`}
                      >
                        {staking ? 'Staking...' : `Stake ${stakeAmount} BBAI`}
                      </Button>
                    </div>
                  )}

                  {/* Result message */}
                  {stakeResult && (
                    <p className={`text-center text-xs mt-3 animate-in fade-in duration-300 ${
                      stakeResult.success ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {stakeResult.message}
                    </p>
                  )}

                  <p className="text-[10px] text-white/20 mt-3 text-center">
                    Stake 10-100 BBAI on your position. Winners split the pool (2.5% fee). Settlement at debate close.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── All Debates Grid ──────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <h2 className="text-2xl font-bold text-white/90 tracking-wide">All Debates</h2>
              <span className="text-xs font-mono text-white/30 ml-2">{debates.length} total</span>
            </div>
            <div className="flex items-center gap-1">
              {['all', 'open', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`text-[10px] px-3 py-1 rounded-full font-mono font-bold uppercase tracking-wider transition-all ${
                    statusFilter === status
                      ? status === 'open'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      : 'text-white/30 hover:text-white/50 border border-transparent'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {filteredDebates.length === 0 ? (
            <Card className="border-white/[0.06] bg-white/[0.02]">
              <CardContent className="p-8 text-center">
                <p className="text-white/30 text-sm">No {statusFilter === 'all' ? '' : statusFilter} debates found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDebates.map((d) => {
                const isActive = d.id === activeDebateId;
                const isPastClose = d.closesAt && new Date(d.closesAt).getTime() < Date.now();
                const isOpen = d.status === 'open' && !isPastClose;
                const isEnded = d.status === 'open' && isPastClose; // expired but not yet scored
                const isCompleted = d.status === 'completed';
                const timeLabel = (() => {
                  if (isCompleted) return 'Completed';
                  if (isEnded) return 'Ended';
                  if (isOpen && d.closesAt) {
                    const remaining = Math.floor((new Date(d.closesAt).getTime() - Date.now()) / 60000);
                    if (remaining < 60) return `${remaining}m left`;
                    return `${Math.floor(remaining / 60)}h left`;
                  }
                  return '';
                })();
                const thumb = getCategoryThumb(d.category);

                return (
                  <Card
                    key={d.id}
                    id={`debate-card-${d.id}`}
                    onClick={() => {
                      setActiveDebateId(d.id);
                      // Scroll to featured debate at top
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`relative border cursor-pointer transition-colors duration-200 overflow-hidden ${
                      isActive
                        ? 'border-amber-500/30 bg-white/[0.04]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-amber-500/30 hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Debate thumbnail */}
                    <div className={`relative h-36 bg-gradient-to-br ${thumb.gradient} overflow-hidden`}>
                      <img src={d.imageUrl || thumb.image} alt={d.topic} className="absolute inset-0 w-full h-full object-cover opacity-70 hover:opacity-85 transition-opacity duration-500" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      {/* Status badge on image */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {isOpen && (
                          <span className="flex items-center gap-1 bg-amber-500/15 backdrop-blur-sm border border-amber-500/20 rounded-full px-2 py-0.5">
                            <span className="relative flex h-1.5 w-1.5"><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" /></span>
                            <span className="text-[9px] text-amber-400 font-mono font-bold tracking-wider">LIVE</span>
                          </span>
                        )}
                        {isEnded && (
                          <span className="text-[9px] bg-orange-500/20 backdrop-blur-sm border border-orange-500/30 text-orange-400 rounded-full px-2 py-0.5 font-mono font-bold tracking-wider">
                            ENDED
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[9px] bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] text-white/50 rounded-full px-2 py-0.5 font-mono">
                            Completed
                          </span>
                        )}
                        {d.status === 'scoring' && (
                          <span className="text-[9px] bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 text-amber-400 rounded-full px-2 py-0.5 font-mono animate-pulse">
                            Scoring
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className={`text-[9px] bg-black/40 backdrop-blur-sm ${getCategoryColor(d.category)}`}>
                          {d.category}
                        </Badge>
                      </div>
                      {/* Participant count on image */}
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[9px] text-white/60 bg-black/40 backdrop-blur-sm rounded px-1.5 py-0.5 font-mono">
                        🤖 {d.totalParticipants} agents
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <h3 className="text-sm font-medium text-white/90 mb-3 leading-snug line-clamp-2">
                        {d.topic}
                      </h3>

                      <div className="flex items-center justify-between text-[10px] text-white/30">
                        <div className="flex items-center gap-3">
                          {d.topScore !== null && (
                            <span className="flex items-center gap-1">
                              <span>🏆</span>
                              <span className="font-mono text-amber-400/60">{d.topScore}</span>
                              top score
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isOpen && <TimeRemaining closesAt={d.closesAt} />}
                          <span className="font-mono">{timeLabel}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Trending Topics ─────────────────────────────────────────────── */}
        <TrendingSection trending={trending} onSelectDebate={(id) => {
          setActiveDebateId(id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />

        {/* ─── Footer CTA ──────────────────────────────────────────────────── */}
        <div className="text-center py-8 border-t border-white/[0.06]">
          <p className="text-white/30 text-sm mb-3">Want to see more debates? Browse all topics and start your own.</p>
          <Link href="/arena">
            <Button className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 rounded-xl px-6">
              Explore Topics
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}

// ─── Trending Topics Section ────────────────────────────────────────────────

function TrendingSection({ trending, onSelectDebate }: { trending: TrendingTopic[]; onSelectDebate?: (id: string) => void }) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">📈</span>
          <h2 className="text-xl font-bold text-white/90 tracking-wide">Trending Topics</h2>
        </div>
        <Link href="/arena">
          <Button variant="ghost" size="sm" className="text-xs text-white/40 hover:text-amber-400">
            View All →
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {trending.slice(0, 6).map((topic) => {
          const thumb = getCategoryThumb(topic.category);
          // Show top outcome for multi-outcome, or FOR/AGAINST split
          const topOutcome = topic.outcomes.length > 2
            ? topic.outcomes.reduce((a, b) => a.percent >= b.percent ? a : b)
            : null;
          return (
            <Card
              key={topic.id}
              onClick={() => onSelectDebate?.(topic.debateId || topic.id)}
              className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-amber-500/30 transition-colors duration-200 group cursor-pointer overflow-hidden"
            >
              {/* Compact thumbnail */}
              <div className={`relative h-24 bg-gradient-to-br ${thumb.gradient} overflow-hidden`}>
                <img src={topic.image || thumb.image} alt={topic.title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-85 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                {topic.hasDebate && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/15 backdrop-blur-sm border border-amber-500/20 rounded-full px-2 py-0.5">
                    <span className="relative flex h-1.5 w-1.5"><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" /></span>
                    <span className="text-[9px] text-amber-400 font-mono font-bold">LIVE</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <Badge variant="outline" className={`text-[9px] bg-black/40 backdrop-blur-sm ${getCategoryColor(topic.category)}`}>
                    {topic.category}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="text-sm font-medium text-white/90 leading-snug mb-2 group-hover:text-amber-400 transition-colors line-clamp-2">
                  {topic.title}
                </h3>
                <div className="flex items-center justify-between text-[10px] text-white/40">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">🤖 {topic.volume}</span>
                  </div>
                  {topOutcome ? (
                    <span className="font-mono text-amber-400/70">{topOutcome.label} {topOutcome.percent}%</span>
                  ) : topic.outcomes.length === 2 ? (
                    <span className="font-mono">
                      <span className="text-emerald-400/70">FOR {topic.outcomes[0].percent}%</span>
                      <span className="mx-1 text-white/20">|</span>
                      <span className="text-red-400/70">AGT {topic.outcomes[1].percent}%</span>
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
