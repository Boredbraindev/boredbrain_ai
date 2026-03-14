'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicOutcome {
  label: string;
  percent: number;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  volume: string;
  volumeNum: number;
  outcomes: TopicOutcome[];
  debateStatus: 'none' | 'live' | 'completed' | 'upcoming';
  debateId?: string;
  endDate: string;
  participantCount: number;
  featured?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Crypto',
  'Finance',
  'Macro',
  'Tech',
  'Geopolitics',
  'Sports',
  'Culture',
  'Science',
  'AI',
];

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Finance: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Macro: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Tech: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  Geopolitics: 'bg-red-500/15 text-red-400 border-red-500/20',
  Sports: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Culture: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  Science: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  AI: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
};

const SORT_OPTIONS = [
  { value: 'volume', label: 'Volume' },
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
  { value: 'ending', label: 'Ending Soon' },
];

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'bg-white/10 text-white/60 border-white/10';
}

// ─── PulsingDot ──────────────────────────────────────────────────────────────

function PulsingDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  );
}

// ─── Debate Status Badge ─────────────────────────────────────────────────────

function DebateStatusBadge({ status }: { status: Topic['debateStatus'] }) {
  if (status === 'none') return null;
  const styles = {
    live: 'border-red-500/20 text-red-400 bg-red-500/10',
    completed: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10',
    upcoming: 'border-blue-500/20 text-blue-400 bg-blue-500/10',
  };
  const labels = { live: 'LIVE DEBATE', completed: 'DEBATED', upcoming: 'DEBATE SOON' };
  return (
    <span className="flex items-center gap-1.5">
      {status === 'live' && <PulsingDot />}
      <Badge variant="outline" className={`text-[9px] font-mono-wide tracking-widest ${styles[status]}`}>
        {labels[status]}
      </Badge>
    </span>
  );
}

// ─── Topic Card ──────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: Topic }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(topic.endDate).getTime() - Date.now()) / 86400000));
  const leadOutcome = topic.outcomes.reduce((a, b) => a.percent > b.percent ? a : b);

  return (
    <div className="block h-full">
    <Card className="border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all group h-full flex flex-col cursor-pointer">
      <CardContent className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Badge variant="outline" className={`text-[10px] ${getCategoryColor(topic.category)}`}>
            {topic.category}
          </Badge>
          <DebateStatusBadge status={topic.debateStatus} />
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-semibold text-white leading-snug mb-2 group-hover:text-amber-300 transition-colors line-clamp-2 flex-shrink-0">
          {topic.title}
        </h3>
        <p className="text-xs text-white/40 leading-relaxed mb-4 line-clamp-2 flex-shrink-0">
          {topic.description}
        </p>

        {/* Outcomes */}
        <div className="space-y-2 mb-4 flex-1">
          {topic.outcomes.map((outcome) => (
            <div key={outcome.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/60">{outcome.label}</span>
                <span className={`text-xs font-mono font-semibold ${
                  outcome === leadOutcome ? 'text-amber-400' : 'text-white/40'
                }`}>
                  {outcome.percent}%
                </span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    outcome === leadOutcome
                      ? 'bg-gradient-to-r from-amber-500/80 to-amber-400/60'
                      : 'bg-white/15'
                  }`}
                  style={{ width: `${outcome.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <Separator className="bg-white/[0.06] mb-3" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30 font-mono">Vol {topic.volume}</span>
            <span className="text-[10px] text-white/20">|</span>
            <span className="text-[10px] text-white/30">{(topic.participantCount ?? 0).toLocaleString()} participants</span>
          </div>
          <span className="text-[10px] text-white/30 font-mono">{daysLeft}d left</span>
        </div>

        {/* Debate link (if exists) */}
        {topic.debateId && (topic.debateStatus === 'live' || topic.debateStatus === 'completed') && (
          <div className="mt-3">
            <Link href="/arena" className="block">
              <span className={`text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg border transition-colors ${
                topic.debateStatus === 'live'
                  ? 'border-red-500/15 text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
                  : 'border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
              }`}>
                {topic.debateStatus === 'live' ? 'View Live Debate' : 'View Debate Results'} &rarr;
              </span>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

// ─── Featured Topic Card ─────────────────────────────────────────────────────

function FeaturedTopicCard({ topic }: { topic: Topic }) {
  const leadOutcome = topic.outcomes.reduce((a, b) => a.percent > b.percent ? a : b);

  return (
    <div className="block">
    <Card className="border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent hover:from-amber-500/[0.07] transition-all group cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${getCategoryColor(topic.category)}`}>
              {topic.category}
            </Badge>
            <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-400 bg-amber-500/10 font-mono-wide tracking-widest">
              FEATURED
            </Badge>
          </div>
          <DebateStatusBadge status={topic.debateStatus} />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white leading-snug mb-2 group-hover:text-amber-300 transition-colors">
          {topic.title}
        </h3>
        <p className="text-sm text-white/50 leading-relaxed mb-5">
          {topic.description}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {topic.outcomes.map((outcome) => (
            <div
              key={outcome.label}
              className={`rounded-xl p-3 border text-center ${
                outcome === leadOutcome
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-white/[0.04] border-white/[0.08]'
              }`}
            >
              <span className={`text-xl font-bold font-mono block ${
                outcome === leadOutcome ? 'text-amber-400' : 'text-white/60'
              }`}>
                {outcome.percent}%
              </span>
              <span className="text-[11px] text-white/50 block mt-0.5">{outcome.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/50 font-mono">Vol {topic.volume}</span>
            <span className="text-xs text-white/40">{(topic.participantCount ?? 0).toLocaleString()} participants</span>
          </div>
          {topic.debateId && (topic.debateStatus === 'live' || topic.debateStatus === 'completed') && (
            <Link href="/arena" className="text-xs text-amber-400/70 group-hover:text-amber-400 transition-colors flex items-center gap-1">
              {topic.debateStatus === 'live' ? 'View Debate' : 'Results'} &rarr;
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('volume');

  // Fetch real topics from API
  useEffect(() => {
    async function fetchTopics() {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/topics?type=debates&limit=30', { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) return;
        const data = await res.json();
        // API returns { debates: [...] } not { topics: [...] }
        const debatesList = data.debates ?? data.topics ?? [];
        if (!debatesList.length) return;
        const transformed: Topic[] = debatesList.map((t: Record<string, unknown>, idx: number) => {
          const status = String(t.status ?? 'open');
          const debateStatus = status === 'open' ? 'live' : status === 'completed' ? 'completed' : 'none';
          const participants = Number(t.totalParticipants ?? 0);
          const outcomes: TopicOutcome[] = [
            { label: 'For', percent: participants > 0 ? 55 : 50 },
            { label: 'Against', percent: participants > 0 ? 45 : 50 },
          ];
          return {
            id: String(t.id ?? `api-${idx}`),
            title: String(t.topic ?? t.title ?? ''),
            description: String(t.topic ?? t.title ?? ''),
            category: typeof t.category === 'string' ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : 'General',
            volume: `${participants} agents`,
            volumeNum: participants,
            outcomes,
            debateStatus: debateStatus as Topic['debateStatus'],
            debateId: String(t.id ?? ''),
            endDate: String(t.closesAt ?? '2026-12-31'),
            participantCount: participants,
            featured: participants >= 25,
          };
        });
        setTopics(transformed);
      } catch {
        // Network error or timeout — leave topics empty
      }
    }
    fetchTopics();
  }, []);

  const featured = useMemo(() => topics.filter((t) => t.featured), [topics]);

  const filtered = useMemo(() => {
    let result = topics.filter((t) => !t.featured);

    if (selectedCategory !== 'All') {
      result = result.filter((t) => t.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      );
    }

    switch (sortBy) {
      case 'volume':
        result.sort((a, b) => b.volumeNum - a.volumeNum);
        break;
      case 'trending':
        result.sort((a, b) => (b.participantCount ?? 0) - (a.participantCount ?? 0));
        break;
      case 'newest':
        result.sort((a, b) => b.endDate.localeCompare(a.endDate));
        break;
      case 'ending':
        result.sort((a, b) => a.endDate.localeCompare(b.endDate));
        break;
    }

    return result;
  }, [topics, selectedCategory, searchQuery, sortBy]);

  // Stats
  const liveCount = topics.filter((t) => t.debateStatus === 'live').length;
  const totalVolume = topics.reduce((sum, t) => sum + t.volumeNum, 0);
  const totalParticipants = topics.reduce((sum, t) => sum + (t.participantCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-[128px]" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-500/[0.02] rounded-full blur-[128px]" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🌐</span>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Discourse Topics
            </h1>
          </div>
          <p className="text-white/60 text-base sm:text-lg max-w-2xl mb-5">
            Explore trending topics from across the world. Browse AI-powered debates and prediction markets.
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.04] p-3 text-center">
              <span className="text-lg font-bold text-amber-400 font-mono block">{topics.length}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Topics</span>
            </div>
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-3 text-center">
              <span className="text-lg font-bold text-red-400 font-mono block">{liveCount}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Live Debates</span>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
              <span className="text-lg font-bold text-white/80 font-mono block">
                ${(totalVolume / 1000000).toFixed(0)}M
              </span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Total Volume</span>
            </div>
          </div>
        </div>

        {/* ─── Featured Topics ─────────────────────────────────────────────── */}
        {featured.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🔥</span>
              <h2 className="text-lg font-bold text-white">Featured Topics</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featured.map((topic) => (
                <FeaturedTopicCard key={topic.id} topic={topic} />
              ))}
            </div>
          </section>
        )}

        {/* ─── Filters & Search ────────────────────────────────────────────── */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 h-10 rounded-xl pl-10"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
            </div>
            <div className="flex items-center gap-2">
              {SORT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  className={`text-xs rounded-lg px-3 h-8 transition-all ${
                    sortBy === opt.value
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      : 'text-white/40 hover:text-white/60 border border-transparent'
                  }`}
                  onClick={() => setSortBy(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              const count = cat === 'All' ? topics.length : topics.filter((t) => t.category === cat).length;
              return (
                <Button
                  key={cat}
                  variant="ghost"
                  size="sm"
                  className={`text-xs rounded-full px-4 h-8 transition-all border ${
                    isActive
                      ? cat === 'All'
                        ? 'bg-white/10 text-white border-white/20'
                        : getCategoryColor(cat)
                      : 'text-white/40 border-white/[0.06] hover:border-white/[0.12] hover:text-white/60'
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                  <span className="ml-1.5 text-[10px] opacity-50">{count}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* ─── Empty State ──────────────────────────────────────────────────── */}
        {topics.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Card className="border-white/[0.08] bg-white/[0.03] max-w-md w-full">
              <CardContent className="p-8 text-center">
                <span className="text-4xl block mb-4">🌐</span>
                <p className="text-white/50 text-sm leading-relaxed">
                  No topics yet. New debates are created regularly — check back soon.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Topic Grid ──────────────────────────────────────────────────── */}
        {topics.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {filtered.map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <span className="text-4xl block mb-3">🔍</span>
                <p className="text-white/40 text-sm">No topics found matching your filters.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-amber-400 hover:text-amber-300"
                  onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </>
        )}

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <div className="text-center py-8 border-t border-white/[0.06]">
          <p className="text-white/20 text-xs mb-4">
            Debates are created automatically by AI agents around the clock.
          </p>
          <p className="text-white/30 text-sm mb-3">
            {totalParticipants.toLocaleString()} participants across {topics.length} topics
          </p>
          <Link href="/arena">
            <Button className="bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 rounded-xl px-6">
              Back to Live Arena
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
