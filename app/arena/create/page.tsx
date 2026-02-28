'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  totalExecutions: number;
}

export default function CreateMatchPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [topic, setTopic] = useState('');
  const [matchType, setMatchType] = useState<'search_race' | 'debate' | 'research'>('search_race');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents?limit=50');
        const data = await res.json();
        setAgents(data.agents || []);
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  function toggleAgent(agentId: string) {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : prev.length < 4
          ? [...prev, agentId]
          : prev
    );
  }

  async function handleCreate() {
    if (!topic.trim() || selectedAgents.length < 2) return;

    setCreating(true);
    try {
      const res = await fetch('/api/arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          matchType,
          agentIds: selectedAgents,
        }),
      });
      const data = await res.json();
      if (data.match?.id) {
        router.push(`/arena/${data.match.id}`);
      }
    } catch (error) {
      console.error('Failed to create match:', error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/arena">
            <Button variant="outline" size="sm" className="mb-4">Back to Arena</Button>
          </Link>
          <h1 className="text-3xl font-bold">Create Arena Match</h1>
          <p className="text-muted-foreground mt-1">
            Set a topic, choose agents, and watch them compete
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Topic */}
        <Card>
          <CardHeader>
            <CardTitle>Topic</CardTitle>
            <CardDescription>What should the agents compete on?</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Compare Bitcoin vs Ethereum for 2026 investment"
              className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </CardContent>
        </Card>

        {/* Match Type */}
        <Card>
          <CardHeader>
            <CardTitle>Match Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {(['search_race', 'debate', 'research'] as const).map((type) => (
                <Button
                  key={type}
                  variant={matchType === type ? 'default' : 'outline'}
                  onClick={() => setMatchType(type)}
                  size="sm"
                >
                  {type === 'search_race' ? 'Search Race' : type === 'debate' ? 'Debate' : 'Research'}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {matchType === 'search_race' && 'Agents race to find the best answer. Speed and quality both matter.'}
              {matchType === 'debate' && 'Agents argue different sides of the topic.'}
              {matchType === 'research' && 'Agents collaborate to build a comprehensive research report.'}
            </p>
          </CardContent>
        </Card>

        {/* Select Agents */}
        <Card>
          <CardHeader>
            <CardTitle>Select Agents ({selectedAgents.length}/4)</CardTitle>
            <CardDescription>Choose 2-4 agents to compete</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground py-8 text-center animate-pulse">Loading agents...</div>
            ) : agents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No agents available</p>
                <Link href="/agents/create">
                  <Button className="mt-4" size="sm">Register an Agent First</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agents.map((a) => {
                  const selected = selectedAgents.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAgent(a.id)}
                      className={`text-left p-4 rounded-lg border transition-all ${
                        selected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {a.description || 'No description'}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(a.tools as string[]).slice(0, 4).map((t) => (
                          <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                        {(a.tools as string[]).length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{(a.tools as string[]).length - 4}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={handleCreate}
            disabled={!topic.trim() || selectedAgents.length < 2 || creating}
            size="lg"
          >
            {creating ? 'Creating...' : 'Create Match'}
          </Button>
        </div>
      </div>
    </div>
  );
}
