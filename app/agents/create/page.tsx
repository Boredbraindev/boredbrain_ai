'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ToolInfo {
  name: string;
  description: string;
  category: string;
  pricePerCall: number;
}

export default function CreateAgentPage() {
  const router = useRouter();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [pricePerQuery, setPricePerQuery] = useState('10');
  const [chainId, setChainId] = useState(8453);

  useEffect(() => {
    async function fetchTools() {
      try {
        const res = await fetch('/api/tools');
        const data = await res.json();
        setTools(data.tools || []);
      } catch (error) {
        console.error('Failed to fetch tools:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTools();
  }, []);

  function toggleTool(toolName: string) {
    setSelectedTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  }

  const estimatedCost = selectedTools.reduce((sum, t) => {
    const tool = tools.find((x) => x.name === t);
    return sum + (tool?.pricePerCall || 0);
  }, 0);

  async function handleCreate() {
    if (!name.trim() || selectedTools.length === 0) return;

    setCreating(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          tools: selectedTools,
          capabilities: selectedTools,
          pricePerQuery,
          chainId,
        }),
      });
      const data = await res.json();
      if (data.agent?.id) {
        router.push(`/agents/${data.agent.id}`);
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setCreating(false);
    }
  }

  const categories = ['search', 'finance', 'location', 'media', 'utility'];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/agents">
            <Button variant="outline" size="sm" className="mb-4">Back to Marketplace</Button>
          </Link>
          <h1 className="text-3xl font-bold">Create AI Agent</h1>
          <p className="text-muted-foreground mt-1">
            Combine tools, set a prompt, and register your agent on-chain as an NFT
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., CryptoAnalyst Pro"
                className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does your agent do?"
                rows={2}
                className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">System Prompt (optional)</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Custom instructions for your agent's behavior..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tool Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Tools ({selectedTools.length} selected)</CardTitle>
            <CardDescription>
              Choose which tools your agent can use. Estimated cost per query: {estimatedCost} USDT
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center animate-pulse text-muted-foreground">Loading tools...</div>
            ) : (
              <div className="space-y-6">
                {categories.map((cat) => {
                  const catTools = tools.filter((t) => t.category === cat);
                  if (catTools.length === 0) return null;
                  return (
                    <div key={cat}>
                      <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
                        {cat}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {catTools.map((tool) => {
                          const selected = selectedTools.includes(tool.name);
                          return (
                            <button
                              key={tool.name}
                              onClick={() => toggleTool(tool.name)}
                              className={`text-left p-3 rounded-lg border transition-all ${
                                selected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{tool.name}</span>
                                <span className="text-xs text-muted-foreground">{tool.pricePerCall} USDT</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {tool.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing & Chain */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Chain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Price per Query (USDT)</label>
              <input
                type="number"
                value={pricePerQuery}
                onChange={(e) => setPricePerQuery(e.target.value)}
                min="0"
                className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Blockchain</label>
              <div className="flex gap-3">
                <Button
                  variant={chainId === 8453 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChainId(8453)}
                >
                  Base
                </Button>
                <Button
                  variant={chainId === 56 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChainId(56)}
                >
                  BNB Smart Chain
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Registration fee: 100 USDT (on-chain NFT minting)
          </p>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || selectedTools.length === 0 || creating}
            size="lg"
          >
            {creating ? 'Creating...' : 'Register Agent (100 USDT)'}
          </Button>
        </div>
      </div>
    </div>
  );
}
