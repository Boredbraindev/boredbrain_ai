'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentListing {
  agentId: string;
  name: string;
  description: string;
  longDescription: string;
  specialization: string;
  tools: string[];
  pricing: {
    perCall: number;
    subscription: number | null;
  };
  rating: number;
  reviewCount: number;
  totalCalls: number;
  successRate: number;
  avgResponseTime: number;
  featured: boolean;
  verified: boolean;
  createdAt: string;
  tags: string[];
  developer: {
    address: string;
    name: string;
    agentCount: number;
  };
}

interface AgentReview {
  id: string;
  agentId: string;
  reviewerAddress: string;
  reviewerName: string;
  rating: number;
  title: string;
  comment: string;
  helpful: number;
  timestamp: string;
}

interface AgentPerformance {
  agentId: string;
  period: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgResponseTime: number;
  totalEarned: number;
  uniqueCallers: number;
  topTools: { tool: string; calls: number }[];
  hourlyActivity: { hour: number; calls: number }[];
}

// Tool pricing lookup for display
const TOOL_PRICES: Record<string, number> = {
  web_search: 1,
  x_search: 2,
  coin_data: 3,
  coin_ohlc: 5,
  wallet_analyzer: 10,
  stock_chart: 5,
  academic_search: 3,
  reddit_search: 2,
  youtube_search: 2,
  code_interpreter: 8,
  retrieve: 1,
  text_translate: 1,
  currency_converter: 1,
  token_retrieval: 5,
  nft_retrieval: 5,
  extreme_search: 50,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StarRating({
  rating,
  size = 'sm',
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const full = Math.floor(rating);
  const partial = rating - full;
  const sizeClass =
    size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizeClass} ${
            star <= full
              ? 'text-yellow-500'
              : star === full + 1 && partial > 0
                ? 'text-yellow-500/50'
                : 'text-muted-foreground/20'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <div
          className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        {sub && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityChart({
  data,
}: {
  data: { hour: number; calls: number }[];
}) {
  const maxCalls = Math.max(...data.map((d) => d.calls), 1);

  return (
    <div className="flex items-end gap-[3px] h-32">
      {data.map((item) => {
        const height = Math.max((item.calls / maxCalls) * 100, 4);
        return (
          <div
            key={item.hour}
            className="flex-1 group relative"
            title={`${item.hour}:00 - ${item.calls} calls`}
          >
            <div
              className="w-full bg-primary/60 hover:bg-primary transition-colors rounded-t-sm cursor-pointer"
              style={{ height: `${height}%` }}
            />
            {/* Tooltip on hover */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {item.hour}:00 &middot; {item.calls}
            </div>
            {/* Hour labels for every 4th hour */}
            {item.hour % 4 === 0 && (
              <div className="text-[9px] text-muted-foreground text-center mt-1">
                {item.hour}h
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewCard({ review }: { review: AgentReview }) {
  const date = new Date(review.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const truncatedAddress =
    review.reviewerAddress.slice(0, 6) +
    '...' +
    review.reviewerAddress.slice(-4);

  return (
    <div className="py-4 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StarRating rating={review.rating} />
            <span className="text-sm font-semibold truncate">{review.title}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {review.comment}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="font-medium">{review.reviewerName}</span>
            <span className="font-mono">{truncatedAddress}</span>
            <span>{formattedDate}</span>
            {review.helpful > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                  />
                </svg>
                {review.helpful} helpful
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [listing, setListing] = useState<AgentListing | null>(null);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [performance, setPerformance] = useState<Record<
    string,
    AgentPerformance
  > | null>(null);
  const [activePeriod, setActivePeriod] = useState<'24h' | '7d' | '30d'>(
    '24h',
  );
  const [loading, setLoading] = useState(true);

  // Review form state
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewName, setReviewName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    async function fetchAgent() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`/api/marketplace/${agentId}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setListing(data.listing);
        setReviews(data.reviews || []);
        setPerformance(data.performance || null);
      } catch (error) {
        console.error('Failed to fetch agent detail:', error);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    }
    fetchAgent();
  }, [agentId]);

  async function handleSubmitReview() {
    if (!reviewTitle.trim() || !reviewComment.trim() || !reviewName.trim())
      return;

    setSubmittingReview(true);
    setReviewSuccess(false);
    try {
      const res = await fetch(`/api/marketplace/${agentId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: parseInt(reviewRating),
          title: reviewTitle,
          comment: reviewComment,
          reviewerName: reviewName,
          reviewerAddress:
            '0x' + '0'.repeat(40),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReviews((prev) => [data.review, ...prev]);
        setReviewTitle('');
        setReviewComment('');
        setReviewName('');
        setReviewRating('5');
        setReviewSuccess(true);

        // Update listing review count and rating
        if (listing) {
          const allReviews = [data.review, ...reviews];
          const avgRating =
            allReviews.reduce(
              (sum: number, r: AgentReview) => sum + r.rating,
              0,
            ) / allReviews.length;
          setListing({
            ...listing,
            reviewCount: allReviews.length,
            rating: Number(avgRating.toFixed(1)),
          });
        }

        setTimeout(() => setReviewSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setSubmittingReview(false);
    }
  }

  const currentPerf = performance?.[activePeriod];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/50">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-full max-w-lg" />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl mb-6" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-lg">Agent not found</p>
        <Link href="/marketplace">
          <Button variant="outline">Back to Marketplace</Button>
        </Link>
      </div>
    );
  }

  const totalEarned = listing.totalCalls * listing.pricing.perCall;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link href="/marketplace">
            <Button variant="outline" size="sm" className="mb-4">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Marketplace
            </Button>
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold">{listing.name}</h1>
                {listing.verified && (
                  <svg
                    className="w-5 h-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {listing.featured && (
                  <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-[10px]">
                    Featured
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {listing.specialization}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
                {listing.description}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>
                  by{' '}
                  <span className="font-medium text-foreground">
                    {listing.developer.name}
                  </span>
                </span>
                <span className="font-mono">
                  {listing.developer.address.slice(0, 6)}...
                  {listing.developer.address.slice(-4)}
                </span>
                <span>&middot;</span>
                <span>{listing.developer.agentCount} agents listed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Calls"
            value={listing.totalCalls.toLocaleString()}
          />
          <StatCard
            label="Success Rate"
            value={`${listing.successRate}%`}
            sub={`${(listing.totalCalls * listing.successRate / 100).toFixed(0)} successful`}
          />
          <StatCard
            label="Avg Response"
            value={`${(listing.avgResponseTime / 1000).toFixed(1)}s`}
            sub={`${listing.avgResponseTime}ms`}
          />
          <StatCard
            label="Total Earned"
            value={`${totalEarned.toLocaleString()}`}
            sub="BBAI"
            highlight
          />
        </div>

        {/* Performance Dashboard */}
        {currentPerf && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Performance Dashboard</CardTitle>
                <div className="flex gap-1.5">
                  {(['24h', '7d', '30d'] as const).map((p) => (
                    <Button
                      key={p}
                      variant={activePeriod === p ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => setActivePeriod(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <CardDescription>
                Hourly activity for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Activity chart */}
              <ActivityChart data={currentPerf.hourlyActivity} />

              {/* Period stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-bold">
                    {currentPerf.totalCalls.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Calls ({activePeriod})
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-bold text-green-500">
                    {currentPerf.successfulCalls.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Successful
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-bold">
                    {currentPerf.uniqueCallers.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Unique Callers
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-bold text-primary">
                    {currentPerf.totalEarned.toLocaleString()} BBAI
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Earned ({activePeriod})
                  </div>
                </div>
              </div>

              {/* Top tools */}
              {currentPerf.topTools.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Top Tools by Usage
                  </h4>
                  <div className="space-y-2">
                    {currentPerf.topTools.map((t) => {
                      const maxToolCalls = Math.max(
                        ...currentPerf.topTools.map((x) => x.calls),
                        1,
                      );
                      const pct = (t.calls / maxToolCalls) * 100;
                      return (
                        <div
                          key={t.tool}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className="w-32 font-mono truncate text-muted-foreground">
                            {t.tool}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-muted-foreground">
                            {t.calls.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* About / Long Description */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {listing.longDescription}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {listing.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tools Section */}
        <Card>
          <CardHeader>
            <CardTitle>Tools ({listing.tools.length})</CardTitle>
            <CardDescription>
              Tools available when invoking this agent, with per-tool BBAI pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {listing.tools.map((tool) => {
                const price = TOOL_PRICES[tool];
                return (
                  <div
                    key={tool}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-xs font-mono truncate">{tool}</span>
                    {price !== undefined && (
                      <Badge
                        variant="outline"
                        className="text-[10px] ml-1.5 shrink-0"
                      >
                        {price} BBAI
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Card */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <div className="text-sm font-medium">Per Call</div>
                <div className="text-xs text-muted-foreground">
                  Pay per invocation
                </div>
              </div>
              <div className="text-2xl font-bold text-primary">
                {listing.pricing.perCall} BBAI
              </div>
            </div>
            {listing.pricing.subscription && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                <div>
                  <div className="text-sm font-medium">Monthly Subscription</div>
                  <div className="text-xs text-muted-foreground">
                    Unlimited calls for 30 days
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  {listing.pricing.subscription} BBAI
                </div>
              </div>
            )}
            <Button className="w-full h-12 text-base" size="lg">
              Invoke This Agent
            </Button>
          </CardContent>
        </Card>

        {/* Reviews Section */}
        <Card>
          <CardHeader>
            <CardTitle>Reviews ({reviews.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Average rating display */}
            <div className="flex items-center gap-6 p-4 rounded-lg bg-muted/30">
              <div className="text-center">
                <div className="text-4xl font-bold">
                  {listing.rating.toFixed(1)}
                </div>
                <StarRating rating={listing.rating} size="md" />
                <div className="text-xs text-muted-foreground mt-1">
                  {listing.reviewCount} reviews
                </div>
              </div>
              <Separator orientation="vertical" className="h-16" />
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter(
                    (r) => r.rating === star,
                  ).length;
                  const pct =
                    reviews.length > 0
                      ? (count / reviews.length) * 100
                      : 0;
                  return (
                    <div
                      key={star}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-3 text-muted-foreground">
                        {star}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-yellow-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-muted-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Review list */}
            <div className="divide-y divide-border/50">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            {reviews.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No reviews yet. Be the first to review this agent.
              </div>
            )}

            <Separator />

            {/* Write a Review form */}
            <div>
              <h3 className="text-base font-semibold mb-4">Write a Review</h3>
              {reviewSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-600 dark:text-green-400">
                  Review submitted successfully. Thank you for your feedback.
                </div>
              )}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      Your Name
                    </label>
                    <Input
                      placeholder="e.g. CryptoTrader.eth"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      Rating
                    </label>
                    <Select
                      value={reviewRating}
                      onValueChange={setReviewRating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 - Excellent</SelectItem>
                        <SelectItem value="4">4 - Very Good</SelectItem>
                        <SelectItem value="3">3 - Good</SelectItem>
                        <SelectItem value="2">2 - Fair</SelectItem>
                        <SelectItem value="1">1 - Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Review Title
                  </label>
                  <Input
                    placeholder="Summarize your experience"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Your Review
                  </label>
                  <Textarea
                    placeholder="Share your experience with this agent..."
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSubmitReview}
                  disabled={
                    submittingReview ||
                    !reviewTitle.trim() ||
                    !reviewComment.trim() ||
                    !reviewName.trim()
                  }
                  className="w-full sm:w-auto"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
