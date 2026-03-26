'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentInfo {
  id: string;
  name: string;
  status: string;
  specialization: string;
  totalCalls: number;
  totalEarned: number;
}

interface UserPointsInfo {
  walletAddress: string;
  totalBp: number;
  level: number;
  streakDays: number;
}

interface TopicInfo {
  id: string;
  topic: string;
  status: string;
  totalParticipants: number;
  totalPool: number;
  category: string;
}

interface EconomyStats {
  totalVolume: number;
  platformFees: number;
  activeWallets: number;
}

interface LogEntry {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Newbie',
  2: 'Trader',
  3: 'Analyst',
  4: 'Strategist',
  5: 'Whale',
  6: 'OG',
};

const SEED_TOPICS = [
  { topic: 'Will Ethereum ETF inflows exceed $10B by Q3 2026?', category: 'crypto' },
  { topic: 'Can AI agents outperform human traders in DeFi yield farming?', category: 'ai' },
  { topic: 'Should DAOs implement quadratic voting for treasury decisions?', category: 'governance' },
  { topic: 'Will Layer 3 solutions make Layer 2 obsolete within 2 years?', category: 'defi' },
  { topic: 'Is the NFT market entering a genuine recovery or a dead cat bounce?', category: 'crypto' },
  { topic: 'Will on-chain identity replace traditional KYC by 2028?', category: 'governance' },
  { topic: 'Can decentralized AI inference compete with centralized providers on cost?', category: 'ai' },
  { topic: 'Will Bitcoin dominance drop below 40% this cycle?', category: 'crypto' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || '???';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'verified':
    case 'online':
    case 'open':
      return 'bg-green-500';
    case 'pending':
    case 'scoring':
      return 'bg-yellow-500';
    case 'completed':
      return 'bg-blue-500';
    case 'offline':
    case 'suspended':
      return 'bg-red-500';
    default:
      return 'bg-muted-foreground/40';
  }
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function AdminSkeleton() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 py-8">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-5 w-72 mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardContent className="py-6"><Skeleton className="h-10 w-20 mb-2" /><Skeleton className="h-3 w-24" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const searchParams = useSearchParams();
  const secret = searchParams.get('secret');

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [users, setUsers] = useState<UserPointsInfo[]>([]);
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [economy, setEconomy] = useState<EconomyStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);

  // Auth check
  if (secret !== ADMIN_SECRET) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">&#x1f512;</div>
            <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
            <p className="text-muted-foreground text-sm">
              Add <code className="bg-muted px-1.5 py-0.5 rounded text-xs">?secret=...</code> to access this panel.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const addLog = useCallback((msg: string) => {
    setActionLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [agentsRes, usersRes, topicsRes, economyRes, logsRes, healthRes] = await Promise.allSettled([
      fetch('/api/agents/discover?limit=200'),
      fetch('/api/points/topup?leaderboard=1').catch(() => fetch('/api/leaderboard?limit=50')),
      fetch('/api/topics?type=debates&limit=30'),
      fetch('/api/economy/stats'),
      fetch('/api/agents/logs?limit=20'),
      fetch('/api/health/drizzle'),
    ]);

    // Agents
    if (agentsRes.status === 'fulfilled' && agentsRes.value.ok) {
      try {
        const data = await agentsRes.value.json();
        const agentList = data.agents || data.data?.agents || [];
        setAgents(
          agentList.map((a: any) => ({
            id: a.id,
            name: a.name || a.id,
            status: a.status || 'active',
            specialization: a.specialization || 'general',
            totalCalls: a.totalCalls || 0,
            totalEarned: a.totalEarned || 0,
          })),
        );
      } catch {}
    }

    // Users
    if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
      try {
        const data = await usersRes.value.json();
        const userList = data.leaderboard || data.users || [];
        setUsers(
          userList.map((u: any) => ({
            walletAddress: u.walletAddress || u.wallet_address || '0x???',
            totalBp: u.totalBp || u.total_bp || 0,
            level: u.level || 1,
            streakDays: u.streakDays || u.streak_days || 0,
          })),
        );
      } catch {}
    }

    // Topics
    if (topicsRes.status === 'fulfilled' && topicsRes.value.ok) {
      try {
        const data = await topicsRes.value.json();
        const debateList = data.debates || [];
        setTopics(
          debateList.map((d: any) => ({
            id: d.id,
            topic: d.topic,
            status: d.status || 'open',
            totalParticipants: d.totalParticipants || 0,
            totalPool: d.totalPool || 0,
            category: d.category || 'general',
          })),
        );
      } catch {}
    }

    // Economy
    if (economyRes.status === 'fulfilled' && economyRes.value.ok) {
      try {
        const data = await economyRes.value.json();
        setEconomy({
          totalVolume: data.totalVolume || data.volume || 0,
          platformFees: data.platformFees || data.fees || 0,
          activeWallets: data.activeWallets || data.wallets || 0,
        });
      } catch {}
    }

    // Logs
    if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
      try {
        const data = await logsRes.value.json();
        const logList = data.logs || [];
        setLogs(
          logList.slice(0, 20).map((l: any, i: number) => ({
            id: l.id || `log-${i}`,
            type: l.type || l.eventType || 'info',
            message: l.message || l.summary || JSON.stringify(l).slice(0, 120),
            timestamp: l.timestamp || l.createdAt || new Date().toISOString(),
          })),
        );
      } catch {}
    }

    // Health
    if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
      setDbStatus('ok');
    } else {
      setDbStatus('error');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async function runAction(label: string, url: string, method: string = 'POST', body?: any) {
    addLog(`Running: ${label}...`);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const cronSecret = process.env.NEXT_PUBLIC_CRON_SECRET;
      if (cronSecret) {
        headers['Authorization'] = `Bearer ${cronSecret}`;
      }
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.success || res.ok) {
        addLog(`OK: ${label} — ${JSON.stringify(data).slice(0, 150)}`);
      } else {
        addLog(`WARN: ${label} — ${data.error || res.status}`);
      }
      return data;
    } catch (err: any) {
      addLog(`ERR: ${label} — ${err.message}`);
      return null;
    }
  }

  async function seedAgents() {
    await runAction('Seed Agents', '/api/agents/seed');
    fetchAll();
  }

  async function resetStats() {
    await runAction('Reset Stats', '/api/agents/reset-stats');
    fetchAll();
  }

  async function runHeartbeat() {
    const data = await runAction('Heartbeat', '/api/agents/heartbeat', 'GET');
    if (data) {
      setLastHeartbeat(new Date().toISOString());
    }
  }

  async function settleDebates() {
    await runAction('Settle Debates', '/api/topics/settle');
    fetchAll();
  }

  async function seedTopics() {
    for (const t of SEED_TOPICS) {
      await runAction(`Create Topic: ${t.topic.slice(0, 40)}...`, '/api/topics', 'POST', t);
    }
    fetchAll();
  }

  async function createSingleTopic() {
    const topic = SEED_TOPICS[Math.floor(Math.random() * SEED_TOPICS.length)];
    await runAction(`Create Topic`, '/api/topics', 'POST', topic);
    fetchAll();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative z-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <AdminSkeleton />
        </div>
      </div>
    );
  }

  const totalAgentCalls = agents.reduce((sum, a) => sum + a.totalCalls, 0);
  const totalAgentEarned = agents.reduce((sum, a) => sum + a.totalEarned, 0);
  const openTopics = topics.filter((t) => t.status === 'open').length;

  return (
    <div className="min-h-screen bg-background relative z-1">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-b from-red-500/8 via-red-500/3 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-center">
          <Badge variant="destructive" className="mb-3 px-3 py-1">Admin Panel</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            BoredBrain Admin
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Platform management and monitoring dashboard
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ----------------------------------------------------------------- */}
        {/* Key Metrics */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Agents', value: agents.length, color: 'text-blue-400' },
            { label: 'Total Calls', value: totalAgentCalls.toLocaleString(), color: 'text-purple-400' },
            { label: 'Earned (BBAI)', value: totalAgentEarned.toFixed(0), color: 'text-green-400' },
            { label: 'Users', value: users.length, color: 'text-cyan-400' },
            { label: 'Open Topics', value: openTopics, color: 'text-yellow-400' },
            { label: 'DB Status', value: dbStatus === 'ok' ? 'OK' : dbStatus === 'error' ? 'ERR' : '...', color: dbStatus === 'ok' ? 'text-green-400' : 'text-red-400' },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="py-4">
                <div className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{m.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Quick Actions */}
        {/* ----------------------------------------------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Run platform operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={seedAgents} variant="outline">Seed Agents</Button>
              <Button size="sm" onClick={resetStats} variant="outline">Reset Stats</Button>
              <Button size="sm" onClick={runHeartbeat} variant="outline">Run Heartbeat</Button>
              <Button size="sm" onClick={settleDebates} variant="outline">Settle Debates</Button>
              <Button size="sm" onClick={seedTopics} variant="outline">Seed All Topics ({SEED_TOPICS.length})</Button>
              <Button size="sm" onClick={createSingleTopic} variant="outline">Create Random Topic</Button>
              <Separator orientation="vertical" className="h-8 mx-1" />
              <Button size="sm" onClick={fetchAll} variant="default">Refresh Data</Button>
            </div>
            {lastHeartbeat && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Last heartbeat: {new Date(lastHeartbeat).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Action Log */}
        {/* ----------------------------------------------------------------- */}
        {actionLog.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Action Log</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setActionLog([])} className="h-6 text-[10px]">Clear</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-[11px] space-y-0.5">
                {actionLog.map((line, i) => (
                  <div key={i} className={line.includes('ERR') ? 'text-red-400' : line.includes('WARN') ? 'text-yellow-400' : 'text-muted-foreground'}>
                    {line}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ----------------------------------------------------------------- */}
          {/* Agent Management */}
          {/* ----------------------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Agent Management</CardTitle>
                  <CardDescription className="text-xs">{agents.length} agents registered</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={seedAgents}>Seed</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resetStats}>Reset</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-80 overflow-y-auto space-y-1">
                {agents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No agents found</p>
                ) : (
                  agents.slice(0, 50).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-sm">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(a.status)}`} />
                      <span className="font-medium truncate flex-1 min-w-0">{a.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{a.specialization}</Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-14 text-right">
                        {a.totalCalls} calls
                      </span>
                      <span className="text-[10px] text-green-400 tabular-nums shrink-0 w-16 text-right">
                        {a.totalEarned.toFixed(1)} BBAI
                      </span>
                    </div>
                  ))
                )}
                {agents.length > 50 && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    ...and {agents.length - 50} more agents
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ----------------------------------------------------------------- */}
          {/* User Management */}
          {/* ----------------------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">User Management</CardTitle>
              <CardDescription className="text-xs">{users.length} registered users with BP</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-80 overflow-y-auto space-y-1">
                {users.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No users found</p>
                ) : (
                  users.slice(0, 30).map((u, i) => (
                    <div key={u.walletAddress + i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-28 shrink-0">
                        {truncateAddress(u.walletAddress)}
                      </span>
                      <span className="text-xs font-medium flex-1">
                        {LEVEL_NAMES[u.level] || `Lvl ${u.level}`}
                      </span>
                      <span className="text-[10px] text-purple-400 tabular-nums shrink-0">
                        {u.totalBp.toLocaleString()} BP
                      </span>
                      {u.streakDays > 0 && (
                        <span className="text-[10px] text-yellow-400 tabular-nums shrink-0">
                          {u.streakDays}d streak
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* ----------------------------------------------------------------- */}
          {/* Topic / Debate Management */}
          {/* ----------------------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Topics &amp; Debates</CardTitle>
                  <CardDescription className="text-xs">{topics.length} total, {openTopics} open</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={createSingleTopic}>+ New</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={settleDebates}>Settle</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-80 overflow-y-auto space-y-1">
                {topics.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No topics found</p>
                ) : (
                  topics.map((t) => (
                    <div key={t.id} className="p-2 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(t.status)}`} />
                        <span className="text-sm font-medium truncate flex-1">{t.topic}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-4 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{t.category}</Badge>
                        <span>{t.status}</span>
                        <span>{t.totalParticipants} participants</span>
                        {t.totalPool > 0 && <span className="text-green-400">{t.totalPool} BBAI pool</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* ----------------------------------------------------------------- */}
          {/* Economy Overview */}
          {/* ----------------------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Economy Overview</CardTitle>
              <CardDescription className="text-xs">Platform economics and recent activity</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {economy ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Volume</div>
                    <div className="text-lg font-bold text-green-400">{(economy.totalVolume || 0).toLocaleString()}</div>
                    <div className="text-[9px] text-muted-foreground">BBAI</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Platform Fees</div>
                    <div className="text-lg font-bold text-purple-400">{(economy.platformFees || 0).toLocaleString()}</div>
                    <div className="text-[9px] text-muted-foreground">BBAI (15%)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Wallets</div>
                    <div className="text-lg font-bold text-cyan-400">{economy.activeWallets}</div>
                    <div className="text-[9px] text-muted-foreground">agents</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">Economy data unavailable</p>
              )}

              <Separator />

              <div>
                <div className="text-xs font-medium mb-2">Recent Logs</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-xs">No recent logs</p>
                  ) : (
                    logs.map((l) => (
                      <div key={l.id} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">{l.type}</Badge>
                        <span className="flex-1 truncate">{l.message}</span>
                        <span className="shrink-0 tabular-nums">{new Date(l.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* System Health */}
        {/* ----------------------------------------------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${dbStatus === 'ok' ? 'bg-green-500' : dbStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                <div>
                  <div className="text-sm font-medium">Database (Neon)</div>
                  <div className="text-[10px] text-muted-foreground">
                    {dbStatus === 'ok' ? 'Connected' : dbStatus === 'error' ? 'Connection failed' : 'Checking...'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <div className="text-sm font-medium">Edge Runtime</div>
                  <div className="text-[10px] text-muted-foreground">Active (Vercel Edge)</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${lastHeartbeat ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                <div>
                  <div className="text-sm font-medium">Last Heartbeat</div>
                  <div className="text-[10px] text-muted-foreground">
                    {lastHeartbeat ? new Date(lastHeartbeat).toLocaleString() : 'Not run this session'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
