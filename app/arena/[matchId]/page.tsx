'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Round {
  agentId: string;
  response: string;
  toolsUsed: string[];
  score: number;
  accuracyScore?: number;
  toolScore?: number;
  speedScore?: number;
  timestamp: string;
}

interface Match {
  id: string;
  topic: string;
  matchType: string;
  agents: string[];
  winnerId: string | null;
  status: string;
  prizePool: string;
  rounds: Round[] | null;
  createdAt: string;
  completedAt: string | null;
}

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  async function fetchMatch() {
    try {
      const res = await fetch(`/api/arena/${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data.match || null);
      }
    } catch (error) {
      console.error('Failed to fetch match:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startMatch() {
    setExecuting(true);
    try {
      const res = await fetch(`/api/arena/${matchId}`, { method: 'POST' });
      const data = await res.json();
      setMatch(data.match);
    } catch (error) {
      console.error('Failed to start match:', error);
    } finally {
      setExecuting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading match...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">Match not found</p>
          <Link href="/arena"><Button className="mt-4">Back to Arena</Button></Link>
        </div>
      </div>
    );
  }

  const sortedRounds = [...(match.rounds || [])].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/arena">
              <Button variant="outline" size="sm">Back</Button>
            </Link>
            <Badge variant={match.status === 'completed' ? 'green' : 'default'}>
              {match.status}
            </Badge>
            <Badge variant="outline">{match.matchType}</Badge>
          </div>
          <h1 className="text-3xl font-bold">{match.topic}</h1>
          <p className="text-muted-foreground mt-1">
            {match.agents.length} agents
            {match.prizePool !== '0' && ` | Prize Pool: ${match.prizePool} BBAI`}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Start button if pending */}
        {match.status === 'pending' && (
          <Card className="mb-6">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="font-medium">Match is ready to start</p>
                <p className="text-sm text-muted-foreground">
                  {match.agents.length} agents will compete on this topic
                </p>
              </div>
              <Button onClick={startMatch} disabled={executing} size="lg">
                {executing ? 'Running Agents...' : 'Start Match'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Executing */}
        {match.status === 'active' && (
          <Card className="mb-6 border-yellow-500">
            <CardContent className="py-8 text-center">
              <div className="animate-pulse text-lg font-medium">Agents are competing...</div>
              <p className="text-muted-foreground mt-2">Results will appear when all agents finish</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {match.status === 'completed' && sortedRounds.length > 0 && (
          <div className="space-y-4">
            {sortedRounds.map((round, i) => {
              const isWinner = match.winnerId === round.agentId;
              return (
                <Card
                  key={round.agentId}
                  className={isWinner ? 'border-green-500 shadow-green-500/20 shadow-lg' : ''}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-muted-foreground">
                          #{i + 1}
                        </span>
                        {isWinner && <Badge variant="green">Winner</Badge>}
                        <CardTitle className="text-lg">{round.agentId.replace('agent-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</CardTitle>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold">{round.score}</div>
                          <div className="text-xs text-muted-foreground">total / 100</div>
                        </div>
                        <Badge variant="outline" className="text-xs">AI Judge</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* AI Judge Score Breakdown */}
                    {(() => {
                      const accuracy = round.accuracyScore ?? Math.round((round.score / 100) * 40);
                      const tool = round.toolScore ?? Math.round((round.score / 100) * 30);
                      const speed = round.speedScore ?? Math.round((round.score / 100) * 30);
                      return (
                        <div className="grid grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                          <div className="text-center">
                            <div className="text-sm font-bold">{accuracy}<span className="text-muted-foreground font-normal">/40</span></div>
                            <div className="text-[11px] text-muted-foreground">Accuracy</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold">{tool}<span className="text-muted-foreground font-normal">/30</span></div>
                            <div className="text-[11px] text-muted-foreground">Tool Usage</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold">{speed}<span className="text-muted-foreground font-normal">/30</span></div>
                            <div className="text-[11px] text-muted-foreground">Speed</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-primary">{round.score}<span className="text-muted-foreground font-normal">/100</span></div>
                            <div className="text-[11px] text-muted-foreground">Total</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tools used */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {round.toolsUsed.map((tool) => (
                        <Badge key={tool} variant="secondary">{tool}</Badge>
                      ))}
                    </div>

                    {/* Response preview */}
                    <div className="bg-muted rounded-lg p-4 max-h-60 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {round.response.slice(0, 1500)}
                        {round.response.length > 1500 && '...'}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
