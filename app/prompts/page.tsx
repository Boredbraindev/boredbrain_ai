'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface PromptTemplate {
  id: string;
  creatorName: string | null;
  title: string;
  description: string;
  category: string;
  tags: string[];
  previewMessages: Array<{ role: string; content: string }>;
  tools: string[];
  price: string;
  totalSales: number;
  totalRevenue: string;
  rating: number;
  ratingCount: number;
  featured: boolean;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  all: { label: 'All', icon: '', color: '' },
  coding: { label: 'Coding', icon: '💻', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  research: { label: 'Research', icon: '🔬', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  finance: { label: 'Finance', icon: '📊', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  creative: { label: 'Creative', icon: '✨', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  marketing: { label: 'Marketing', icon: '📈', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  general: { label: 'General', icon: '🧠', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

function PromptCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-14 rounded-full" />)}
        </div>
        <Skeleton className="h-20 rounded-lg" />
      </CardContent>
    </Card>
  );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-3 h-3 ${star <= full ? 'text-yellow-500' : star === full + 1 && partial > 0 ? 'text-yellow-500/50' : 'text-muted-foreground/20'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">({count})</span>
    </div>
  );
}

export default function PromptMarketplacePage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'cheap' | 'new'>('popular');

  useEffect(() => {
    async function fetchPrompts() {
      try {
        const res = await fetch('/api/prompts?limit=50');
        const data = await res.json();
        setPrompts(data.prompts || []);
      } catch (error) {
        console.error('Failed to fetch prompts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPrompts();
  }, []);

  const filteredPrompts = useMemo(() => {
    let result = category === 'all'
      ? prompts
      : prompts.filter((p) => p.category === category);

    if (sortBy === 'rating') result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'cheap') result = [...result].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sortBy === 'new') result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else result = [...result].sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0));

    return result;
  }, [prompts, category, sortBy]);

  const totalPrompts = prompts.length;
  const totalSales = prompts.reduce((sum, p) => sum + (p.totalSales || 0), 0);
  const totalRevenue = prompts.reduce((sum, p) => sum + parseFloat(p.totalRevenue || '0'), 0);

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Hero Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-amber-500/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Prompt Store</h1>
                <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-widest">Beta</Badge>
              </div>
              <p className="text-muted-foreground mt-1 max-w-lg">
                Buy & sell AI-crafted system prompts. Each prompt is a battle-tested AI agent personality that you can deploy instantly.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline" size="sm">Back to Search</Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline" size="sm">Agent Marketplace</Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3 mt-8">
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalPrompts}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Prompts</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalSales.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Sales</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <div className="text-lg sm:text-xl font-bold">{totalRevenue.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">BBAI Volume</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filter & Sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Tabs value={category} onValueChange={setCategory} className="w-full sm:w-auto">
            <TabsList className="h-9 flex-wrap">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <TabsTrigger key={key} value={key} className="text-xs px-3">
                  {config.icon ? `${config.icon} ` : ''}{config.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            {([
              { value: 'popular', label: 'Best Sellers' },
              { value: 'rating', label: 'Top Rated' },
              { value: 'cheap', label: 'Cheapest' },
              { value: 'new', label: 'Newest' },
            ] as const).map((s) => (
              <Button
                key={s.value}
                variant={sortBy === s.value ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSortBy(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Featured Section */}
        {!loading && category === 'all' && sortBy === 'popular' && (
          <>
            {filteredPrompts.filter((p) => p.featured).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-amber-500">★</span> Featured Prompts
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPrompts.filter((p) => p.featured).map((p) => (
                    <PromptCard key={p.id} prompt={p} featured />
                  ))}
                </div>
                <Separator className="mt-8" />
              </div>
            )}
          </>
        )}

        {/* Prompt Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <PromptCardSkeleton key={i} />)}
          </div>
        ) : filteredPrompts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-muted-foreground text-lg font-medium">No prompts found</p>
              <p className="text-muted-foreground text-sm mt-1">Try a different category or create your own.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrompts
              .filter((p) => !(category === 'all' && sortBy === 'popular' && p.featured))
              .map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PromptCard({ prompt: p, featured = false }: { prompt: PromptTemplate; featured?: boolean }) {
  const catConfig = CATEGORY_CONFIG[p.category] || CATEGORY_CONFIG.general;

  return (
    <Link href={`/prompts/${p.id}`}>
      <Card className={`h-full group hover:border-primary/40 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-primary/5 ${featured ? 'ring-1 ring-amber-500/20' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
              {p.title}
            </CardTitle>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${catConfig.color}`}>
              {catConfig.icon} {catConfig.label}
            </span>
          </div>
          <CardDescription className="line-clamp-2 text-xs">
            {p.description || 'No description'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(p.tags || []).slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>

          {/* Preview Chat Bubble */}
          {p.previewMessages && p.previewMessages.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
              {p.previewMessages.slice(0, 2).map((msg, i) => (
                <div key={i} className={`text-[11px] ${i > 0 ? 'mt-2' : ''}`}>
                  <span className={`font-semibold ${msg.role === 'user' ? 'text-blue-400' : 'text-amber-400'}`}>
                    {msg.role === 'user' ? 'You' : 'AI'}:
                  </span>{' '}
                  <span className="text-muted-foreground line-clamp-2">{msg.content}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tools */}
          {p.tools && p.tools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.tools.slice(0, 3).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{t}</Badge>
              ))}
              {p.tools.length > 3 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{p.tools.length - 3}</Badge>
              )}
            </div>
          )}

          <Separator className="my-1" />

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-sm font-bold text-amber-500">{p.price}</div>
              <div className="text-[9px] text-muted-foreground uppercase">BBAI</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-sm font-bold">{(p.totalSales || 0).toLocaleString()}</div>
              <div className="text-[9px] text-muted-foreground uppercase">Sales</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-sm font-bold">{(p.rating || 0).toFixed(1)}</div>
              <div className="text-[9px] text-muted-foreground uppercase">Rating</div>
            </div>
          </div>

          {/* Rating + Creator */}
          <div className="flex items-center justify-between">
            <StarRating rating={p.rating || 0} count={p.ratingCount || 0} />
            <span className="text-[10px] text-muted-foreground">
              by {p.creatorName || 'Anonymous'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
