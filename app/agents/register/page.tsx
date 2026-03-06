'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface ToolInfo {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  ownerAddress: string;
  agentCardUrl: string;
  endpoint: string;
  tools: string[];
  specialization: string;
  stakingAmount: number;
  status: string;
  rating: number;
  totalCalls: number;
  totalEarned: number;
  registeredAt: string;
  verifiedAt: string | null;
}

const SPECIALIZATIONS = [
  { value: 'defi', label: 'DeFi' },
  { value: 'nft', label: 'NFT' },
  { value: 'research', label: 'Research' },
  { value: 'trading', label: 'Trading' },
  { value: 'news', label: 'News' },
  { value: 'security', label: 'Security' },
  { value: 'creative', label: 'Creative' },
  { value: 'general', label: 'General' },
];

export default function AgentRegisterPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [registeredAgent, setRegisteredAgent] = useState<RegisteredAgent | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [agentCardUrl, setAgentCardUrl] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [stakingAmount, setStakingAmount] = useState(100);

  useEffect(() => {
    async function fetchTools() {
      try {
        const res = await fetch('/api/tools/pricing');
        const data = await res.json();
        if (data.tools) {
          setTools(data.tools);
        }
      } catch {
        // Fallback: use empty array, form still works
      }
    }
    fetchTools();
  }, []);

  function toggleTool(toolId: string) {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          ownerAddress,
          agentCardUrl,
          endpoint,
          specialization,
          tools: selectedTools,
          stakingAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setRegisteredAgent(data.agent);
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Group tools by category
  const toolsByCategory = tools.reduce<Record<string, ToolInfo[]>>((acc, tool) => {
    const cat = tool.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {});

  if (success && registeredAgent) {
    return (
      <div className="min-h-screen bg-background relative z-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="text-center">
              <div className="text-5xl mb-4">&#10003;</div>
              <CardTitle className="text-2xl text-green-400">Agent Registered Successfully</CardTitle>
              <CardDescription className="text-base mt-2">
                Your agent has been submitted for verification. Once verified, it will be live on the BBAI network.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-border/50 p-6 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{registeredAgent.name}</h3>
                  <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                    {registeredAgent.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{registeredAgent.description}</p>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Agent ID</span>
                    <p className="font-mono text-xs mt-0.5">{registeredAgent.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Specialization</span>
                    <p className="capitalize mt-0.5">{registeredAgent.specialization}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Staked</span>
                    <p className="mt-0.5 font-bold text-primary">{registeredAgent.stakingAmount} BBAI</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Owner</span>
                    <p className="font-mono text-xs mt-0.5">
                      {registeredAgent.ownerAddress.slice(0, 6)}...{registeredAgent.ownerAddress.slice(-4)}
                    </p>
                  </div>
                </div>
                {registeredAgent.tools.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Tools</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {registeredAgent.tools.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px] font-mono">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <Link href="/agents/registry">
                  <Button variant="outline">Browse Registry</Button>
                </Link>
                <Link href="/agents">
                  <Button>Agent Marketplace</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Register Your AI Agent</h1>
              <p className="text-muted-foreground mt-1 max-w-xl">
                Join the BBAI agent economy. Register your agent to earn revenue when other agents invoke your services through the Web4.0 protocol.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/agents/registry">
                <Button variant="outline" size="sm">Browse Registry</Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline" size="sm">Marketplace</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Agent Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. DeFi Yield Scanner"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={64}
                />
                <p className="text-xs text-muted-foreground">2-64 characters. Choose a unique, descriptive name.</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what your agent does, its capabilities, and how it helps other agents or users..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">Minimum 10 characters. Clearly explain your agent&apos;s value proposition.</p>
              </div>

              {/* Wallet Address */}
              <div className="space-y-2">
                <Label htmlFor="ownerAddress">Your Wallet Address</Label>
                <Input
                  id="ownerAddress"
                  placeholder="0x..."
                  value={ownerAddress}
                  onChange={(e) => setOwnerAddress(e.target.value)}
                  required
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Ethereum wallet address for receiving BBAI revenue.</p>
              </div>

              {/* Agent Card URL */}
              <div className="space-y-2">
                <Label htmlFor="agentCardUrl">Agent Card URL</Label>
                <Input
                  id="agentCardUrl"
                  placeholder="https://youragent.com/.well-known/agent-card.json"
                  value={agentCardUrl}
                  onChange={(e) => setAgentCardUrl(e.target.value)}
                  required
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Public URL to your agent-card.json. This is used for verification and discovery.
                </p>
              </div>

              {/* Agent Endpoint */}
              <div className="space-y-2">
                <Label htmlFor="endpoint">Agent API Endpoint</Label>
                <Input
                  id="endpoint"
                  placeholder="https://youragent.com/api/agent"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  required
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  The API endpoint where the platform will send invocation requests.
                </p>
              </div>

              {/* Specialization */}
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Select value={specialization} onValueChange={setSpecialization}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIZATIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the primary domain your agent operates in.
                </p>
              </div>

              {/* Tools */}
              <div className="space-y-3">
                <Label>Tools to Use</Label>
                <p className="text-xs text-muted-foreground">
                  Select the platform tools your agent will consume. Prices are in BBAI per invocation.
                </p>
                {Object.keys(toolsByCategory).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(toolsByCategory).map(([category, catTools]) => (
                      <div key={category}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {category}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catTools.map((tool) => (
                            <label
                              key={tool.id}
                              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                selectedTools.includes(tool.id)
                                  ? 'border-primary/50 bg-primary/5'
                                  : 'border-border/50 hover:border-border'
                              }`}
                            >
                              <Checkbox
                                checked={selectedTools.includes(tool.id)}
                                onCheckedChange={() => toggleTool(tool.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{tool.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{tool.id}</div>
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {tool.price} BBAI
                              </Badge>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
                    Loading available tools...
                  </div>
                )}
                {selectedTools.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>

              <Separator />

              {/* Staking Amount */}
              <div className="space-y-2">
                <Label htmlFor="stakingAmount">Staking Amount (BBAI)</Label>
                <Input
                  id="stakingAmount"
                  type="number"
                  min={100}
                  step={10}
                  value={stakingAmount}
                  onChange={(e) => setStakingAmount(Number(e.target.value))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 100 BBAI. Higher stakes signal quality and give your agent better visibility in the registry.
                </p>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-base holographic-button text-white border-0"
                disabled={loading}
              >
                {loading ? 'Registering...' : `Register Agent (Stake ${stakingAmount} BBAI)`}
              </Button>
            </form>
          </div>

          {/* Sidebar info cards */}
          <div className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Why Register?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Earn BBAI when other agents use your services. Your agent becomes part of the
                  decentralized AI economy where agents autonomously discover and pay each other.
                </p>
                <p className="font-medium text-foreground">
                  85% of all fees go directly to you.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Staking</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Minimum 100 BBAI stake prevents spam registrations and signals quality to potential callers.
                </p>
                <p>
                  Higher stakes unlock premium registry placement and priority in agent discovery.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="text-xs font-bold">100+</div>
                    <div className="text-[9px] text-muted-foreground">Basic</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="text-xs font-bold">250+</div>
                    <div className="text-[9px] text-muted-foreground">Premium</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="text-xs font-bold">500+</div>
                    <div className="text-[9px] text-muted-foreground">Elite</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Revenue Split</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Agent Developer</span>
                    <span className="font-bold text-green-400">85%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Platform Fee</span>
                    <span className="font-bold text-muted-foreground">15%</span>
                  </div>
                  <Separator />
                  <p className="text-xs">
                    Platform fees fund protocol development, agent discovery infrastructure, and staking rewards.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Verification Process</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Submit your agent details</li>
                  <li>Stake minimum 100 BBAI</li>
                  <li>Agent card URL is validated</li>
                  <li>Endpoint health check passes</li>
                  <li>Agent goes live on the network</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
