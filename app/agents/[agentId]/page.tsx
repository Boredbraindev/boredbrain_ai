'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  tools: string[];
  pricePerQuery: string;
  nftTokenId: number | null;
  chainId: number | null;
  txHash: string | null;
  totalExecutions: number;
  totalRevenue: string;
  rating: number;
  status: string;
  createdAt: string;
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        const data = await res.json();
        setAgent(data.agent);
      } catch (error) {
        console.error('Failed to fetch agent:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAgent();
  }, [agentId]);

  async function handleTest() {
    if (!testQuery.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: 'Execution failed' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading agent...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/agents">
            <Button variant="outline" size="sm" className="mb-4">Back to Marketplace</Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            {agent.nftTokenId !== null && <Badge variant="green">NFT #{agent.nftTokenId}</Badge>}
            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>{agent.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-2">{agent.description || 'No description'}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Price/Query', value: `${agent.pricePerQuery} BBAI` },
            { label: 'Executions', value: String(agent.totalExecutions) },
            { label: 'Revenue', value: `${agent.totalRevenue} BBAI` },
            { label: 'Rating', value: agent.rating?.toFixed(1) || '0.0' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tools */}
        <Card>
          <CardHeader>
            <CardTitle>Tools ({(agent.tools as string[]).length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(agent.tools as string[]).map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* On-chain Info */}
        {(agent.chainId || agent.txHash) && (
          <Card>
            <CardHeader>
              <CardTitle>On-chain Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agent.chainId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Chain</span>
                  <Badge variant="outline">
                    {agent.chainId === 8453 ? 'Base' : agent.chainId === 56 ? 'BSC' : `Chain ${agent.chainId}`}
                  </Badge>
                </div>
              )}
              {agent.nftTokenId !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">NFT Token ID</span>
                  <span className="text-sm font-mono">#{agent.nftTokenId}</span>
                </div>
              )}
              {agent.txHash && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Registration TX</span>
                  <span className="text-sm font-mono">{agent.txHash.slice(0, 10)}...{agent.txHash.slice(-8)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Agent */}
        <Card>
          <CardHeader>
            <CardTitle>Test Agent</CardTitle>
            <CardDescription>Send a test query to see how this agent responds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Enter a test query..."
                className="flex-1 px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              />
              <Button onClick={handleTest} disabled={!testQuery.trim() || testing}>
                {testing ? 'Running...' : 'Execute'}
              </Button>
            </div>

            {testResult && (
              <div className="bg-muted rounded-lg p-4 max-h-80 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
