'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface PromptDetail {
  id: string;
  creatorId: string | null;
  creatorName: string | null;
  title: string;
  description: string;
  systemPrompt: string;
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

const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  coding: { icon: '💻', label: 'Coding' },
  research: { icon: '🔬', label: 'Research' },
  finance: { icon: '📊', label: 'Finance' },
  creative: { icon: '✨', label: 'Creative' },
  marketing: { icon: '📈', label: 'Marketing' },
  general: { icon: '🧠', label: 'General' },
};

export default function PromptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const promptId = params.promptId as string;

  const [prompt, setPrompt] = useState<PromptDetail | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    async function fetchPrompt() {
      try {
        const res = await fetch(`/api/prompts/${promptId}`);
        const data = await res.json();
        setPrompt(data.prompt || null);
        setPurchased(data.purchased || false);
      } catch (error) {
        console.error('Failed to fetch prompt:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPrompt();
  }, [promptId]);

  async function handlePurchase() {
    setPurchasing(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purchase' }),
      });
      const data = await res.json();
      if (data.success) {
        setPurchased(true);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setPurchasing(false);
    }
  }

  async function handleConvertToAgent() {
    setConverting(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert_to_agent' }),
      });
      const data = await res.json();
      if (data.agent?.id) {
        router.push(`/agents/${data.agent.id}`);
      }
    } catch (error) {
      console.error('Conversion failed:', error);
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-lg font-medium">Prompt not found</p>
            <Link href="/prompts" className="mt-4">
              <Button variant="outline">Back to Store</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const catInfo = CATEGORY_LABELS[prompt.category] || CATEGORY_LABELS.general;

  return (
    <div className="min-h-screen bg-background relative z-1">
      <div className="border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/prompts">
            <Button variant="outline" size="sm" className="mb-4">Back to Prompt Store</Button>
          </Link>

          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{prompt.title}</h1>
                {prompt.featured && (
                  <Badge variant="secondary" className="text-amber-500 border-amber-500/30">
                    ★ Featured
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{prompt.description}</p>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="outline" className="text-xs">
                  {catInfo.icon} {catInfo.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  by <span className="font-medium text-foreground">{prompt.creatorName || 'Anonymous'}</span>
                </span>
              </div>
            </div>

            {/* Purchase / Actions */}
            <div className="flex flex-col gap-2 min-w-[200px]">
              {purchased ? (
                <>
                  <Badge variant="green" className="text-center py-2 text-sm">Owned</Badge>
                  <Button
                    onClick={handleConvertToAgent}
                    disabled={converting}
                    className="holographic-button text-white border-0"
                  >
                    {converting ? 'Converting...' : 'Deploy as Agent'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  size="lg"
                  className="holographic-button text-white border-0"
                >
                  {purchasing ? 'Purchasing...' : `Buy for ${prompt.price} BBAI`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{prompt.price}</div>
              <div className="text-xs text-muted-foreground uppercase">BBAI Price</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{(prompt.totalSales || 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground uppercase">Sales</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{(prompt.rating || 0).toFixed(1)}</div>
              <div className="text-xs text-muted-foreground uppercase">Rating ({prompt.ratingCount || 0})</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{parseFloat(prompt.totalRevenue || '0').toLocaleString()}</div>
              <div className="text-xs text-muted-foreground uppercase">BBAI Volume</div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Conversation */}
        {prompt.previewMessages && prompt.previewMessages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview Conversation</CardTitle>
              <CardDescription>See how this prompt performs in action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {prompt.previewMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500/10 border border-blue-500/20 ml-8'
                      : 'bg-amber-500/10 border border-amber-500/20 mr-8'
                  }`}
                >
                  <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    msg.role === 'user' ? 'text-blue-400' : 'text-amber-400'
                  }`}>
                    {msg.role === 'user' ? 'User' : 'AI Agent'}
                  </div>
                  <p className="text-sm text-foreground/90">{msg.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* System Prompt (blurred if not purchased) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Prompt</CardTitle>
            <CardDescription>
              {purchased
                ? 'Full system prompt — copy and use in your own agents'
                : 'Purchase to unlock the full system prompt'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {purchased ? (
              <div className="relative">
                <pre className="bg-muted/50 p-4 rounded-lg text-sm whitespace-pre-wrap break-words border border-border/30 max-h-96 overflow-y-auto">
                  {prompt.systemPrompt}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => navigator.clipboard.writeText(prompt.systemPrompt)}
                >
                  Copy
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="bg-muted/50 p-4 rounded-lg text-sm border border-border/30 h-32 overflow-hidden">
                  <p className="text-muted-foreground blur-sm select-none">
                    {prompt.systemPrompt.slice(0, 200)}...
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🔒</div>
                    <p className="text-sm font-medium">Purchase to unlock</p>
                    <Button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      size="sm"
                      className="mt-2 holographic-button text-white border-0"
                    >
                      {purchasing ? 'Purchasing...' : `${prompt.price} BBAI`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tools */}
        {prompt.tools && prompt.tools.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended Tools</CardTitle>
              <CardDescription>Best used with these tools for optimal results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {prompt.tools.map((tool) => (
                  <Badge key={tool} variant="outline" className="text-xs px-3 py-1 font-mono">
                    {tool}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {prompt.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deploy as Agent CTA */}
        {purchased && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold text-lg">Deploy as AI Agent</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Turn this prompt into a live AI agent on the marketplace and start earning BBAI from every query.
                </p>
              </div>
              <Button
                onClick={handleConvertToAgent}
                disabled={converting}
                size="lg"
                className="holographic-button text-white border-0 shrink-0"
              >
                {converting ? 'Deploying...' : 'Deploy Agent'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
