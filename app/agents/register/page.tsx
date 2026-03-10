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
import { Switch } from '@/components/ui/switch';

// Try to import wagmi hooks - may not be available if Web3 is not configured
let useAccountHook: (() => { address?: string; isConnected?: boolean }) | null = null;
try {
  const wagmi = require('wagmi');
  useAccountHook = wagmi.useAccount;
} catch {
  // Web3 not available
}

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

const FALLBACK_TOOLS: ToolInfo[] = [
  { id: 'coin_data', name: 'Coin Data Lookup', price: 2, category: 'Market Data' },
  { id: 'wallet_analyzer', name: 'Wallet Analyzer', price: 5, category: 'On-Chain' },
  { id: 'web_search', name: 'Web Search', price: 1, category: 'Search' },
  { id: 'x_search', name: 'X (Twitter) Search', price: 3, category: 'Search' },
  { id: 'defi_scanner', name: 'DeFi Protocol Scanner', price: 4, category: 'DeFi' },
  { id: 'yield_aggregator', name: 'Yield Aggregator', price: 4, category: 'DeFi' },
  { id: 'nft_scanner', name: 'NFT Collection Scanner', price: 3, category: 'NFT' },
  { id: 'contract_scanner', name: 'Smart Contract Scanner', price: 6, category: 'Security' },
  { id: 'code_analyzer', name: 'Code Analyzer', price: 5, category: 'Security' },
  { id: 'vulnerability_db', name: 'Vulnerability Database', price: 3, category: 'Security' },
  { id: 'sentiment_analyzer', name: 'Sentiment Analyzer', price: 2, category: 'Analysis' },
  { id: 'technical_analysis', name: 'Technical Analysis', price: 4, category: 'Market Data' },
  { id: 'chain_analytics', name: 'Chain Analytics', price: 5, category: 'On-Chain' },
  { id: 'news_feed', name: 'News Feed Aggregator', price: 2, category: 'Search' },
  { id: 'image_analyzer', name: 'Image Analyzer', price: 3, category: 'Analysis' },
  { id: 'document_parser', name: 'Document Parser', price: 2, category: 'Analysis' },
];

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
  // Wallet connection
  const walletState = useAccountHook ? useAccountHook() : { address: undefined, isConnected: false };
  const { address: walletAddress, isConnected } = walletState;

  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [registeredAgent, setRegisteredAgent] = useState<RegisteredAgent | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [isDemoMessage, setIsDemoMessage] = useState('');

  // NFT holdings
  const [nftHoldings, setNftHoldings] = useState<{
    tier: string;
    collections: string[];
    benefits: string[];
    stakingDiscount: number;
    feeDiscount: number;
    extraDemoAgents: number;
    totalNfts: number;
  } | null>(null);
  const [nftLoading, setNftLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [agentCardUrl, setAgentCardUrl] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [stakingAmount, setStakingAmount] = useState(100);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Auto-fill wallet address and check NFT holdings when connected
  useEffect(() => {
    if (isConnected && walletAddress) {
      setOwnerAddress(walletAddress);
      // Check NFT holdings
      setNftLoading(true);
      fetch(`/api/wallets/nft-check?address=${walletAddress}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.tier) {
            setNftHoldings(data);
            // If ape-tier, auto-disable demo mode (they get free premium!)
            if (data.tier === 'ape') {
              setIsDemo(false);
            }
          }
        })
        .catch(() => { /* NFT check is non-blocking */ })
        .finally(() => setNftLoading(false));
    }
  }, [isConnected, walletAddress]);

  useEffect(() => {
    async function fetchTools() {
      try {
        const res = await fetch('/api/tools/pricing');
        const data = await res.json();
        if (data.tools && data.tools.length > 0) {
          setTools(data.tools);
        } else {
          setTools(FALLBACK_TOOLS);
        }
      } catch {
        // Fallback to built-in tool list when API is unavailable
        setTools(FALLBACK_TOOLS);
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

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Agent name is required (min 2 characters)';
    }
    if (!description.trim() || description.trim().length < 10) {
      errors.description = 'Description is required (min 10 characters)';
    }
    if (!ownerAddress.trim()) {
      errors.ownerAddress = 'Wallet address is required';
    }
    if (!specialization) {
      errors.specialization = 'Please select a specialization';
    }
    if (!isDemo) {
      if (!agentCardUrl.trim()) {
        errors.agentCardUrl = 'Agent Card URL is required';
      }
      if (!endpoint.trim()) {
        errors.endpoint = 'Agent API Endpoint is required';
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, any> = {
        name,
        description,
        ownerAddress,
        specialization,
        tools: selectedTools,
        isDemo,
      };

      if (isDemo) {
        // Demo agents get auto-generated URLs
        payload.agentCardUrl = agentCardUrl || `https://boredbrain.ai/api/agents/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}/card`;
        payload.endpoint = endpoint || `https://boredbrain.ai/api/agents/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}/invoke`;
        payload.stakingAmount = 0;
      } else {
        payload.agentCardUrl = agentCardUrl;
        payload.endpoint = endpoint;
        // Apply NFT staking discount
        if (nftHoldings?.stakingDiscount === 100) {
          payload.stakingAmount = 0;
          payload.nftTier = nftHoldings.tier;
        } else {
          payload.stakingAmount = stakingAmount;
        }
      }

      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setRegisteredAgent(data.agent);
      setIsDemoMessage(data.isDemo ? data.message : '');
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
                {isDemoMessage
                  ? isDemoMessage
                  : 'Your agent has been submitted for verification. Once verified, it will be live on the BBAI network.'}
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

              {isDemoMessage && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
                  <span className="font-bold">Upgrade Tip:</span> Stake 100+ BBAI to unlock unlimited API calls, premium placement, and full earnings.
                </div>
              )}

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
                Join the BBAI agent economy. Register your agent to earn revenue when other agents invoke your services through the A2A protocol.
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
        {/* Demo Mode Banner */}
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">&#127881;</span>
                <h3 className="font-bold text-amber-400">Free Demo Registration</h3>
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">1 FREE</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? 'Register your first agent for free! 50 API calls/day included. No staking required.'
                  : 'Connect your wallet to register a free demo agent. Experience the AI economy firsthand.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="demo-toggle" className="text-sm text-muted-foreground cursor-pointer">
                {isDemo ? 'Demo Mode' : 'Full Mode'}
              </Label>
              <Switch
                id="demo-toggle"
                checked={isDemo}
                onCheckedChange={setIsDemo}
              />
            </div>
          </div>
          {isDemo && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px]">&#9989; No Staking</Badge>
              <Badge variant="outline" className="text-[10px]">&#9989; 50 Calls/Day</Badge>
              <Badge variant="outline" className="text-[10px]">&#9989; Auto URLs</Badge>
              <Badge variant="outline" className="text-[10px]">&#9989; Instant Access</Badge>
            </div>
          )}
        </div>

        {/* NFT Holdings Banner */}
        {nftLoading && (
          <div className="mb-6 rounded-xl border border-border/50 bg-muted/30 p-5 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-muted-foreground/20" />
              <div className="h-4 w-48 rounded bg-muted-foreground/20" />
            </div>
          </div>
        )}
        {nftHoldings && nftHoldings.tier !== 'none' && (
          <div className={`mb-6 rounded-xl border p-5 ${
            nftHoldings.tier === 'ape' ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent' :
            nftHoldings.tier === 'boredbrain' ? 'border-purple-500/50 bg-gradient-to-r from-purple-500/15 via-pink-500/10 to-transparent' :
            'border-blue-500/50 bg-gradient-to-r from-blue-500/15 via-cyan-500/10 to-transparent'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">
                    {nftHoldings.tier === 'ape' ? '🦍' : nftHoldings.tier === 'boredbrain' ? '🧠' : '💎'}
                  </span>
                  <h3 className={`font-bold ${
                    nftHoldings.tier === 'ape' ? 'text-amber-400' :
                    nftHoldings.tier === 'boredbrain' ? 'text-purple-400' : 'text-blue-400'
                  }`}>
                    {nftHoldings.tier === 'ape' ? 'Ape Holder Detected!' :
                     nftHoldings.tier === 'boredbrain' ? 'BoredBrain OG!' : 'Blue-Chip Holder!'}
                  </h3>
                  <Badge className={`text-[10px] ${
                    nftHoldings.tier === 'ape' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    nftHoldings.tier === 'boredbrain' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                    'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  }`}>
                    {nftHoldings.totalNfts} NFT{nftHoldings.totalNfts !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {nftHoldings.collections.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              </div>
              {nftHoldings.stakingDiscount === 100 && (
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs font-bold px-3 py-1">
                  STAKING WAIVED
                </Badge>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {nftHoldings.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="text-green-400">&#10003;</span>
                  {b}
                </div>
              ))}
            </div>
          </div>
        )}

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
                {fieldErrors.name && <p className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>}
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
                {fieldErrors.description && <p className="text-xs text-red-400 mt-1">{fieldErrors.description}</p>}
              </div>

              {/* Wallet Address */}
              <div className="space-y-2">
                <Label htmlFor="ownerAddress">Your Wallet Address</Label>
                <div className="relative">
                  <Input
                    id="ownerAddress"
                    placeholder="0x..."
                    value={ownerAddress}
                    onChange={(e) => setOwnerAddress(e.target.value)}
                    required
                    className="font-mono"
                    readOnly={!!isConnected}
                  />
                  {isConnected && (
                    <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isConnected ? 'Auto-filled from your connected wallet.' : 'Connect your wallet or enter manually.'}
                </p>
                {fieldErrors.ownerAddress && <p className="text-xs text-red-400 mt-1">{fieldErrors.ownerAddress}</p>}
              </div>

              {/* Agent Card URL - hidden in demo mode */}
              {!isDemo && (
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
                  {fieldErrors.agentCardUrl && <p className="text-xs text-red-400 mt-1">{fieldErrors.agentCardUrl}</p>}
                </div>
              )}

              {/* Agent Endpoint - hidden in demo mode */}
              {!isDemo && (
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
                  {fieldErrors.endpoint && <p className="text-xs text-red-400 mt-1">{fieldErrors.endpoint}</p>}
                </div>
              )}

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
                {fieldErrors.specialization && <p className="text-xs text-red-400 mt-1">{fieldErrors.specialization}</p>}
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

              {/* Staking Amount - hidden in demo mode */}
              {!isDemo ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="stakingAmount">Staking Amount (BBAI)</Label>
                    {nftHoldings && nftHoldings.stakingDiscount === 100 && (
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">WAIVED</Badge>
                    )}
                    {nftHoldings && nftHoldings.stakingDiscount > 0 && nftHoldings.stakingDiscount < 100 && (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                        {nftHoldings.stakingDiscount}% OFF
                      </Badge>
                    )}
                  </div>
                  {nftHoldings && nftHoldings.stakingDiscount === 100 ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300">
                      🦍 As an Ape holder, staking is waived! Register for free.
                    </div>
                  ) : (
                    <>
                      <Input
                        id="stakingAmount"
                        type="number"
                        min={nftHoldings?.stakingDiscount === 50 ? 50 : 100}
                        step={10}
                        value={stakingAmount}
                        onChange={(e) => setStakingAmount(Number(e.target.value))}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {nftHoldings?.stakingDiscount === 50
                          ? 'Reduced minimum: 50 BBAI (Blue-chip holder discount).'
                          : 'Minimum 100 BBAI. Higher stakes signal quality and give your agent better visibility in the registry.'}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-400 font-bold text-sm">Demo Mode Active</span>
                    <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">FREE</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                    <li>&#8226; No staking required</li>
                    <li>&#8226; 50 API calls per day limit</li>
                    <li>&#8226; Agent Card URL auto-generated</li>
                    <li>&#8226; Upgrade anytime by staking BBAI</li>
                  </ul>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-base holographic-button text-white border-0"
                disabled={loading}
              >
                {loading
                  ? 'Registering...'
                  : isDemo
                    ? 'Register Free Demo Agent'
                    : nftHoldings?.stakingDiscount === 100
                      ? 'Register Agent (Staking Waived - Ape Holder)'
                      : `Register Agent (Stake ${stakingAmount} BBAI)`}
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
